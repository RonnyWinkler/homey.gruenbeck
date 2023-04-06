'use strict';

const { Driver } = require('homey');

class softliqscDriver extends Driver {
  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('softliqscDriver has been initialized');
  }

  onPair(session) {
    this.log("onPair()");

    session.setHandler('showView', async (view) => {
      return await this.onShowView(session, view);
    });

    session.setHandler("list_devices", async () => {
        return await this.onPairListDevices(session);
    });

    session.setHandler("login", async (data) => {
      return await this.checkLogin(data); 
    });
  }

  onRepair(session) {
    this.log("onPair()");

    session.setHandler("login", async (data) => {
      return await this.checkLogin(data); 
    });
  }

  async onShowView(session, view){
    if (view === 'loading') {
        this.log("onShowView(loading)");

        let settings = this.homey.settings.get('settings');
        if (this.homey.app.gruenbeckSrv.isConnected()
            && settings 
            && settings.user && settings.user != "" 
            && settings.password && settings.password != "" ){
            await session.showView("list_devices");
        }
        else{
            if( settings 
                && settings.user && settings.user != "" 
                && settings.password && settings.password != "") {
                try{
                    await this.homey.app.gruenbeckSrv.login(settings.user, settings.password);
                    if (this.homey.app.gruenbeckSrv.isConnected()){
                        await session.showView("list_devices")
                    }
                    else{
                        await session.showView("login_credentials");
                    }
                }
                catch(error){
                    await session.showView("login_credentials");
                }
            }
            else{
                await session.showView("login_credentials");
            }
        }
    }
  }

  async checkLogin(data){
    let user = data.username;
    let password = data.password;

    try{
        await this.homey.app.gruenbeckSrv.login(user, password);
        if (this.homey.app.gruenbeckSrv && this.homey.app.gruenbeckSrv.isConnected()){
  
          await this.homey.settings.set("settings", 
            {
              "user": user,
              "password": password,
              "updateInterval": 5,
              "active": true
            }
          );

          return true;
        }
        else{
          return false;
        }
    }
    catch (error){
        this.log("Connection error in pairing login view: "+error.message);
        return false;
    }
  }

  /**
   * onPairListDevices is called when a user is adding a device and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async onPairListDevices(session) {
    const searchData = await this.homey.app.getDevices(true);
    // Create an array of devices
    let data = {};
    const devices = [];
    if (searchData){
      for (const device of searchData)
      {
        // Filter: only softliQ.D allowed
        if (device.series == "softliQ.C"){  
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
    }
    return devices;
  }

}

module.exports = softliqscDriver;