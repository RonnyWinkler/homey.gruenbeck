'use strict';

const Homey = require('homey');
// Events
const EventEmitter = require('events');
// Services
const gruenbeckSrv = require("./gruenbeck/gruenbeck.js");
const updateIntervalDefault = 15;

class GruenbeckApp extends Homey.App {
  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('Grünbeck has been initialized');
    // Eventhandler
    this.events = new EventEmitter();
    // Grübbeck instance and event handler:
    this.gruenbeckSrv = new gruenbeckSrv();
    this.onWsMessage = this.onWsMessage.bind(this);
    this.gruenbeckSrv.on("wsMessage", this.onWsMessage);
    // local data
    this.diagLog = "";
    this.detectedDevices = "";
    this.user = "";
    this.password = "";
    this.updateInterval = updateIntervalDefault;
    // read app settings
    let settings = this.homey.settings.get('settings');
    if (settings){
      //console.log(settings);
      this.password = settings.password;
      this.user = settings.user;
      this.updateInterval = parseFloat(settings.updateInterval); 
      if (!this.updateInterval || this.updateInterval == 0)
        this.updateInterval = updateIntervalDefault; 
      this.active = settings.active;
    }

    
    this.homey.settings.on('set', (key) =>
    {
        if (key === 'settings')
        {
            let settings = this.homey.settings.get('settings');
            this.password = settings.password;
            this.user = settings.user;
            this.updateInterval = parseFloat(settings.updateInterval);
            if (!this.updateInterval || this.updateInterval == 0)
              this.updateInterval = updateIntervalDefault; 
            this.active = settings.active;
            this.stop();
            if (this.active)
              this.timeoutLoginAttempt = setTimeout(() => this.start().catch(e => console.log(e)), 3 * 1000 );
        }
      });

    if (this.active)
      this.timeoutLoginAttempt = setTimeout(() => this.start().catch(e => console.log(e)), 3 * 1000 );
    else
      this.updateLog(">>>> Periodical device update NOT ACTIVE <<<<");
  }

  async start(){
    this.updateLog(">>>> Periodical device update STARTED <<<<");
    if (!this.user || !this.password){
      this.updateLog("Please set User/Password in app settings.");
    }
    else
    {
      clearTimeout(this.timeoutLoginAttempt);
      try{
        await this.login();
        this.updateLog("---> Connect WebSocket");
        this.gruenbeckSrv.connectMgWebSocket();
        //await this.devicesUpdate();
        // First Start, gibe WS-Connect 5 seconds to connect before reading device data
        this.timeoutDevicesUpdate = setTimeout(() => this.devicesUpdate().catch(e => console.log(e)), 5 * 1000 );

      }
      catch(err){
        this.updateLog("Login Error. Please set user/password in app settings!");
        // retry start&login
        clearTimeout(this.timeoutLoginAttempt);
        this.timeoutLoginAttempt = setTimeout(() => this.start().catch(e => console.log(e)), 10 * 1000 );
      }
    }
  }

  stop(){
    this.updateLog(">>>> Periodical device update STOPPED <<<<");
    clearTimeout(this.timeoutDevicesUpdate);
    clearTimeout(this.timeoutLoginAttempt);
    this.updateLog("---> Close WebSocket");
    this.gruenbeckSrv.closeMgWebSocket();
    //this.gruenbeckSrv.leaveSD();
  }

  async loginTest( ) {
    try{
      await this.login();
      await this.getDevices( );
      return "Login OK";
    }
    catch(err)
    {
      this.updateLog(JSON.stringify(err));
      return JSON.stringify(err);
    }
  }

  async login(){
    this.updateLog("===> Login");
    return this.gruenbeckSrv.login(this.user, this.password);
  }

  async devicesUpdate() {
    this.updateLog("===> Devices Update");
    var deviceStatistic;
    var deviceLiveData;
    const devices = await this.getDevices();
    for(const device of devices ){
      //console.log(device);
      if (device.data.serialNumber){
        // Get Statictic data ofrom REST service 
        this.updateLog("---> Device Statistics: "+device.data.id);
        deviceStatistic = await this.gruenbeckSrv.parseMgInfos(device.data.id);
        this.updateLog(JSON.stringify(deviceStatistic));
        this.deviceUpdateStatistics(device.data.serialNumber, deviceStatistic);
        // Get live data from WebSocket/device
        this.updateLog("---> Device Live Data: "+device.data.id);
        //console.log("---> Enter SD "+device.data.id);
        //deviceLiveData = this.gruenbeckSrv.connectMgWebSocket();
        this.gruenbeckSrv.enterSD(device.data.id)
        .then(() => {
            //console.log("---> Refresh SD");
            this.gruenbeckSrv.refreshSD(device.data.id).catch(() => {
                this.updateLog("---> Failed refresh SD");
            });
            //close SD-connection to prevent too much duplicate websocket updates
            setTimeout(() => this.gruenbeckSrv.leaveSD(device.data.id).catch(e => console.log(e)), 3 * 1000 );
        })
        .catch(() => {
            this.updateLog("---> Failed enter SD");
            this.updateLog("---> Relogin");
            this.login().then(() => {
                this.updateLog("---> Reconnect WebSocket");
                this.gruenbeckSrv.connectMgWebSocket();
            });
        });

      }
    }
    clearTimeout(this.timeoutDevicesUpdate);
    this.timeoutDevicesUpdate = setTimeout(() => this.devicesUpdate().catch(e => console.log(e)), 1000 * 60 * this.updateInterval );
  }

  async getDevices(forceLogin)
  {
    if(forceLogin){
      if (!this.user || !this.password){
        this.updateLog("Please set User/Password in app settings.");
        return;
      }
      await this.login(this.user, this.password);
    }
    this.updateLog("---> Get Devices");
    const devices = [];
    const searchData = await this.gruenbeckSrv.getMgDevices();
    this.detectedDevices = JSON.stringify(searchData);
    this.homey.api.realtime('de.ronnywinkler.homey.gruenbeck.detectedDevicesUpdated', { 'devices': this.detectedDevices });
    //console.log(searchData);
    if (searchData)
    {
      // Create an array of devices
      for (const device of searchData)
      {
        // Filter: only softliQ.D allowed
        if (device.series = "softliQ.D"){  
          let data = {}
          data = {
              "id": device.id,
              "series": device.series,
              "serialNumber": device.serialNumber
          };

          // Add this device to the table
          devices.push(
          {
            "name": device.name,
            data
          });
        }
      }
      this.updateLog(this.detectedDevices);
      return devices;
    }
    else
    {
      this.updateLog("No devices found.");
        //throw (new Error("No devices found"));
    }
  }

  deviceUpdateStatistics(deviceSerialNumber, deviceData){
    // emit event to device instance
    //console.log("WS Statistics Message");
    this.events.emit("deviceUpdateStatics", deviceSerialNumber, deviceData);
  }

  deviceUpdateData(deviceSerialNumber, deviceData){
    // emit event to device instance
    //console.log("WS Data Message");
    this.events.emit("deviceUpdateData", deviceSerialNumber, deviceData);
  }

  //async websocketCallback(data){
  onWsMessage(data){
    let message = JSON.parse(data);
    //console.log(message);
    if (message.type == 1){
      //console.log("WS-Callback:");
      this.updateLog("Live data from device (WebSocket): "+data);
      for (const argument of message.arguments)
      {
        this.deviceUpdateData(argument.id, argument);
      }    
    }
    else if (message.type == 6)
    {
      //console.log("WS-Heartbeat");
    }
  }

  updateLog(newMessage, errorLevel = 1)
  {
      if ((errorLevel == 0) || this.homey.settings.get('logEnabled'))
      {
          console.log(newMessage);
  
          // const nowTime = new Date(Date.now());
  
          // this.diagLog += "\r\n* ";
          // this.diagLog += (nowTime.getHours());
          // this.diagLog += ":";
          // this.diagLog += nowTime.getMinutes();
          // this.diagLog += ":";
          // this.diagLog += nowTime.getSeconds();
          // this.diagLog += ".";

          const tz  = this.homey.clock.getTimezone();
          const nowTime = new Date();
          const now = nowTime.toLocaleString('de-DE', 
              { 
                  hour12: false, 
                  timeZone: tz,
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric"
              });
          var date = now.split(", ")[0];
          date = date.split("/")[2] + "-" + date.split("/")[0] + "-" + date.split("/")[1]; 
          var time = now.split(", ")[1];
          
          this.diagLog += "\r\n* ";
          this.diagLog += date + " " + time + ":";
          this.diagLog += nowTime.getSeconds();
          this.diagLog += ".";
          let milliSeconds = nowTime.getMilliseconds().toString();
          if (milliSeconds.length == 2)
          {
              this.diagLog += '0';
          }
          else if (milliSeconds.length == 1)
          {
              this.diagLog += '00';
          }
          this.diagLog += milliSeconds;
          this.diagLog += "\r\n";
  
          this.diagLog += newMessage;
          this.diagLog += "\r\n";
          if (this.diagLog.length > 60000)
          {
              this.diagLog = this.diagLog.substr(this.diagLog.length - 60000);
          }
          this.homey.api.realtime('de.ronnywinkler.homey.gruenbeck.logupdated', { 'log': this.diagLog });
      }
  }

}


module.exports = GruenbeckApp;