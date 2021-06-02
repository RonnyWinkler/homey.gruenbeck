'use strict';

const Homey = require('homey');
// Events
const EventEmitter = require('events');
// Services
const gruenbeckSDSrv = require("./gruenbeck/gruenbeckSD.js");
const gruenbeckSCSrv = require("./gruenbeck/gruenbeckSC.js");
const updateIntervalDefault = 15;
const reconnectTimer = 30;

class GruenbeckApp extends Homey.App {
  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('Grünbeck has been initialized');
    // Eventhandler
    this.events = new EventEmitter();
    // Grübbeck instance and event handler:
    this.gruenbeckSrv = new gruenbeckSDSrv();
    this.gruenbeckSCSrv = new gruenbeckSCSrv();
    this.gruenbeckSrv.on("wsMessage", this.onWsMessage.bind(this));
    // Timer
    this.timeoutReconnectSD = null;
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

  async reconnectSD(){
    clearTimeout(this.timeoutReconnectSD);
    this.timeoutReconnectSD = null;
    this.updateLog("---> Relogin (Reconnect timer)");
    await this.login().then(() => {
        this.updateLog("---> Reconnect WebSocket");
        this.gruenbeckSrv.connectMgWebSocket();
    });
  }

  async devicesUpdate() {
    clearTimeout(this.timeoutDevicesUpdate);
    this.timeoutDevicesUpdate = setTimeout(() => this.devicesUpdate().catch(e => console.log(e)), 1000 * 60 * this.updateInterval );
    this.updateLog("===> Devices Update");
    let deviceStatistic;
    const devices = await this.getDevices();
    if (devices){
      for(const device of devices ){
        //console.log(device);
        if (device.serialNumber){
          // ==> softliQ-SD Updates
          if (device.series == "softliQ.D"){
            this.updateLog("---> Device: SD");
            // Get Statictic data ofrom REST service 
            this.updateLog("---> Device Statistics: "+device.id);
            deviceStatistic = await this.gruenbeckSrv.parseMgInfos(device.id);
            this.updateLog(JSON.stringify(deviceStatistic));
            this.deviceUpdateStatistics(device.serialNumber, deviceStatistic);
            // Get live data from WebSocket/device
            this.updateLog("---> Device Live Data: "+device.id);
            //console.log("---> Enter SD "+device.data.id);
            this.gruenbeckSrv.enterSD(device.id)
            .then(() => {
                //console.log("---> Refresh SD");
                // clear timer from EnterSD-Error/Reconnect
                clearTimeout(this.timeoutReconnectSD);
                this.timeoutReconnectSD = null;
                this.gruenbeckSrv.refreshSD(device.id).catch(() => {
                    this.updateLog("---> Failed refresh SD");
                });
                //close SD-connection to prevent too much duplicate websocket updates
                setTimeout(() => this.gruenbeckSrv.leaveSD(device.id).catch(() => {
                  this.updateLog("---> Failed leave SD")
                }), 3 * 1000 );
            })
            .catch(() => {
                // Set timer for ReLogin after EnterSD-Error. 
                //This timer is cleared if next EnterSD is ok (device temporary unavailable)
                //Only clear/set timer if not already active to prevent endless timer restarts 
                if (!this.timeoutReconnectSD){
                  this.updateLog("---> Failed enter SD - Started reconnect timer. Wait for next try and ReLogin in "+reconnectTimer+" min if error still occours.");
                  clearTimeout(this.timeoutReconnectSD);
                  this.timeoutReconnectSD = setTimeout(() => this.reconnectSD().catch(e => console.log(e)), 1000 * 60 * reconnectTimer );
                }
                else{
                  this.updateLog("---> Failed enter SD - Reconnect timer is still active. Waiting for connection or reconnect timer.");
                }
                  // this.updateLog("---> Relogin");
                // this.login().then(() => {
                //     this.updateLog("---> Reconnect WebSocket");
                //     this.gruenbeckSrv.connectMgWebSocket();
                // });
            });
          };
          // ==> softliQ-SC Updates
          if (device.series == "softliQ.C"){
            this.updateLog("---> Device: SC (requestAllCommand)");
            try{
              
              //=======================================================================
              // TEST DATA softliQ-SC virtual device data!!!
              // var deviceDataSC = "ok <D_D_1>19.0</D_D_1><D_A_4_1>-</D_A_4_1><D_A_4_2>-</D_A_4_2><D_A_4_3>-</D_A_4_3><D_C_1_1>0</D_C_1_1><D_C_2_1>0</D_C_2_1><D_C_5_1>0</D_C_5_1><D_C_4_1>0</D_C_4_1><D_C_4_2>15:06</D_C_4_2><D_C_4_3>02:00</D_C_4_3><D_C_6_1>0</D_C_6_1><D_C_7_1>368</D_C_7_1><D_A_2_2>183</D_A_2_2><D_A_2_3>99</D_A_2_3><D_C_3_6_1>192.168.86.32/24</D_C_3_6_1><D_C_8_1>-</D_C_8_1><D_C_8_2>-</D_C_8_2><D_C_3_6_2>192.168.86.1</D_C_3_6_2><D_C_3_6_3>192.168.86.1</D_C_3_6_3><D_C_3_6_4>0.0.0.0</D_C_3_6_4><D_C_3_6_5>1</D_C_3_6_5><D_C_3_7_1>192.168.0.1/24</D_C_3_7_1><D_C_3_7_2>softliQ:SC_bf2ec8</D_C_3_7_2><D_C_3_7_3>1</D_C_3_7_3><D_Y_5>0</D_Y_5><D_Y_7>-</D_Y_7><D_Y_6>V01.01.02</D_Y_6><D_Y_8_11>0</D_Y_8_11><D_Y_10_1> 99</D_Y_10_1><D_B_1>0</D_B_1><D_A_1_1>0.00</D_A_1_1><D_A_1_2>0.31</D_A_1_2><D_A_1_3>6.0</D_A_1_3><D_A_2_1>0.0</D_A_2_1><D_A_3_1> 6</D_A_3_1><D_A_3_2>80</D_A_3_2><D_K_1> 830</D_K_1><D_K_2> 207</D_K_2><D_K_3>1.86</D_K_3><D_K_4> 0</D_K_4><D_K_7> 480</D_K_7><D_K_8>2.0</D_K_8><D_K_9>0.11</D_K_9><D_Y_2_1>202</D_Y_2_1><D_Y_4_1> 5h 13min</D_Y_4_1><D_Y_2_2>39</D_Y_2_2><D_Y_4_2> 53h 15min</D_Y_4_2><D_Y_2_3>82</D_Y_2_3><D_Y_4_3> 124h 33min</D_Y_4_3><D_Y_2_4>51</D_Y_2_4><D_Y_4_4> 173h 44min</D_Y_4_4><D_Y_2_5>71</D_Y_2_5><D_Y_4_5> 221h 44min</D_Y_4_5><D_Y_2_6>120</D_Y_2_6><D_Y_4_6> 269h 39min</D_Y_4_6><D_Y_2_7>58</D_Y_2_7><D_Y_4_7> 319h 37min</D_Y_4_7><D_Y_2_8>157</D_Y_2_8><D_Y_4_8> 364h 50min</D_Y_4_8><D_Y_2_9>63</D_Y_2_9><D_Y_4_9> 435h 48min</D_Y_4_9><D_Y_2_10>90</D_Y_2_10><D_Y_4_10> 507h 48min</D_Y_4_10><D_Y_2_11>173</D_Y_2_11><D_Y_4_11> 555h 47min</D_Y_4_11><D_Y_2_12>167</D_Y_2_12><D_Y_4_12> 602h 24min</D_Y_4_12><D_Y_2_13>115</D_Y_2_13><D_Y_4_13> 652h 10min</D_Y_4_13><D_Y_2_14>96</D_Y_2_14><D_Y_4_14> 700h 37min</D_Y_4_14>";
              // this.updateLog(deviceDataSC);
              // this.deviceUpdateSC(device.serialNumber, deviceDataSC);
              //=======================================================================

              var deviceDataSC = await this.gruenbeckSCSrv.requestDataSC(device.ipAddress, this.gruenbeckSCSrv.requestAllCommand);
              this.updateLog(deviceDataSC);
              this.deviceUpdateSC(device.serialNumber, deviceDataSC);

              // alternative parameter for data request
              // this.updateLog("requestActualsCommand");
              // var deviceDataSC = await this.gruenbeckSCSrv.requestDataSC(device.ipAddress, this.gruenbeckSCSrv.requestActualsCommand);
              // this.updateLog(deviceDataSC);
              // this.updateLog("requestAllComrequestErrorsCommandmand");
              // var deviceDataSC = await this.gruenbeckSCSrv.requestDataSC(device.ipAddress, this.gruenbeckSCSrv.requestErrorsCommand);
              // this.updateLog(deviceDataSC);
              // this.updateLog("requestImpulsCommand");
              // var deviceDataSC = await this.gruenbeckSCSrv.requestDataSC(device.ipAddress, this.gruenbeckSCSrv.requestImpulsCommand);
              // this.updateLog(deviceDataSC);
              // this.updateLog("requestDurchflussCommand");
              // var deviceDataSC = await this.gruenbeckSCSrv.requestDataSC(device.ipAddress, this.gruenbeckSCSrv.requestDurchflussCommand);
              // this.updateLog(deviceDataSC);
            }
            catch(err)
            {
              this.updateLog("Error DataRequest SC device");
              this.updateLog(err);
            }
          }
        }
      }
    }
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
    //const searchData = await this.gruenbeckSrv.getMgDevices()
    try{
      const searchData = await this.gruenbeckSrv.getMgDevices();
      this.detectedDevices = JSON.stringify(searchData);
      this.homey.api.realtime('de.ronnywinkler.homey.gruenbeck.detectedDevicesUpdated', { 'devices': this.detectedDevices });
      //console.log(searchData);
      if (searchData)
      {
        //=======================================================================
        //TEST DATA softliQ-SC virtual device!!!
        // searchData.push(
        // {
        //   "ipAddress": "192.168.1.XXX",
        //   "id": "softliQ.C/BS000XXXXX",
        //   "series": "softliQ.C",
        //   "serialNumber": "BS000XXXXX",
        //   "name": "softliQ:sc18"
        // });
        // var dev = JSON.stringify(searchData);
        // this.updateLog(dev);
        //=======================================================================
        
        this.updateLog(this.detectedDevices);
        return searchData;
      }
      else
      {
        this.updateLog("No devices found.");
      }
    }
    catch(err){
      this.updateLog("Error Get Devices: "+err);
    };
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

  deviceUpdateSC(deviceSerialNumber, deviceData){
    // emit event to device instance
    //console.log("WS Data Message");
    this.events.emit("deviceUpdateSC", deviceSerialNumber, deviceData);
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
          let date = now.split(", ")[0];
          date = date.split("/")[2] + "-" + date.split("/")[0] + "-" + date.split("/")[1]; 
          let time = now.split(", ")[1];
          
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