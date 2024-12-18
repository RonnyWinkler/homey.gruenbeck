'use strict';

const { Device } = require('homey');

class softliqscDevice extends Device {
  /**
   * onInit is called when the device is initialized.
   */
    async onInit() {
        this.log('softliqscDevice has been initialized');

        await this.updateCapabilities();

        // register eventhandler for device updates
        this.onDeviceUpdateSCHandler = this.onDeviceUpdateSC.bind(this);
        this.homey.app.events.on("deviceUpdateSC", this.onDeviceUpdateSCHandler);

        // register eventhandler for maintenance buttons
        this.registerCapabilityListener('button.reset_measure_salt_level', this.resetSaltLevel.bind(this));

        // init history data
        if (this.getStoreValue('history_capacity_24h') == undefined) {
          await this.setStoreValue('history_capacity_24h', []);
        }
    }

    async updateCapabilities(){
      // Add new capabilities (if not already added)
      // add new capabilities for version 1.3.0
      if (!this.hasCapability('measure_remaining_percent'))
      {
          await this.addCapability('measure_remaining_percent');
      }
        
    }

    async resetSaltLevel(){
        const settings = this.getSettings();
        return await this.setCapabilityValue('measure_salt_level', settings.salt_level ).catch(this.error);
    }

    async onDeviceUpdateSC(deviceSerialNumber, data){
        if( this.getData().serialNumber != deviceSerialNumber ){
            // event is not valid for this device
            return;
        }

        // Restkapazität
        let indexStart, indexEnd;
        // Restkapazität
        if ( data.indexOf("<D_A_1_2>") != -1 ){
          indexStart = data.indexOf("<D_A_1_2>") + 9;
          indexEnd = data.indexOf("</D_A_1_2>");
          let capacity = parseInt(data.substring(indexStart, indexEnd) * 1000);
          // Kapazität
          // add history value if no value is present yet or capability value has changed
          try{
            let hist = this.getStoreValue('history_capacity_24h');
            if (hist == undefined){
              hist = [];
            }
            if (hist[hist.length == 0] || capacity != this.getCapabilityValue('measure_remaining_capacity') ){
              hist.push({timestamp: new Date(), value: capacity} );
              let windowStart = new Date(Date.now() - WINDOW_SIZE_24H * 1000);
              hist = hist.filter((entry) => {
                return ( new Date(entry.timestamp) > windowStart );
              });
              await this.setStoreValue('history_capacity_24h', hist);              
            }
          }
          catch(error){
            this.log("Error add history value: "+error.message);
          }

          await this.setCapabilityValue('measure_remaining_capacity', capacity ).catch(this.error);
        }
        // Restkapazität Prozent
        if ( data.indexOf("<D_Y_10_1>") != -1 ){
          indexStart = data.indexOf("<D_Y_10_1>") + 10;
          indexEnd = data.indexOf("</D_Y_10_1>");

          // Kapazität in %
          if (this.getSetting('capacity') != undefined && this.getSetting('capacity') > 0){
            // percentage based on total capacity (settings)
            await this.setCapabilityValue('measure_remaining_percent', Math.round( this.getCapabilityValue('measure_remaining_capacity')*100/this.getSetting('capacity') ) ).catch(this.error);
          }
          else{
            // percentage based on device value (% since last regeneration level)
            await this.setCapabilityValue('measure_remaining_percent', parseInt(data.substring(indexStart, indexEnd)) ).catch(this.error);
          }
        }
        // Letzter Wasserverbrauch
        if ( data.indexOf("<D_Y_2_1>") != -1 ){
          indexStart = data.indexOf("<D_Y_2_1>") + 9;
          indexEnd = data.indexOf("</D_Y_2_1>");
          await this.setCapabilityValue('measure_last_waterusage', parseInt(data.substring(indexStart, indexEnd)) ).catch(this.error);
        }
        // Regeneration is active if mregstatus <> 0
        if ( data.indexOf("<D_Y_5>") != -1 ){
          indexStart = data.indexOf("<D_Y_5>") + 7;
          indexEnd = data.indexOf("</D_Y_5>");
          await this.setCapabilityValue('alarm_regeneration_active', parseInt(data.substring(indexStart, indexEnd)) != 0 ).catch(this.error);
        }
        // Letzte Regeneration in %
        if ( data.indexOf("<D_A_3_2>") != -1 ){
          indexStart = data.indexOf("<D_A_3_2>") + 9;
          indexEnd = data.indexOf("</D_A_3_2>");
          await this.setCapabilityValue('measure_last_reg_percent', parseInt(data.substring(indexStart, indexEnd)) ).catch(this.error);
        }
        

        // calculate salt level
        // if (this.getCapabilityValue('measure_last_saltusage') != data.salt[0].value ){
        //     var new_salt_level = this.getCapabilityValue('measure_salt_level') - (data.salt[0].value/1000);
        //     await this.setCapabilityValue('measure_salt_level', new_salt_level).catch(this.error); 
        // }
        // await this.setCapabilityValue('measure_last_saltusage', data.salt[0].value).catch(this.error);
        // await this.setCapabilityValue('meter_water', parseInt( data.mcountwater1 ) ).catch(this.error);
        // await this.setCapabilityValue('meter_salt', parseFloat( data.msaltusage ) ).catch(this.error);            
        // //Regeneration is active if mregstatus <> 0

        // last changed date/time
        //var date = new Date().toISOString().replace("T", " ").split(".")[0];
        const tz  = this.homey.clock.getTimezone();
        const now = new Date().toLocaleString('en-US', 
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
        await this.setCapabilityValue('measure_last_update', date + " " + time).catch(this.error);

        // Realtime event - Widget update 
        await this.homey.api.realtime("device_data_changed", {driver_id:'softliq-sd', device_id: this.getData().id} );
      }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('softliqscDevice has been added');

  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('softliqscDevice settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.log('softliqscDevice was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('softliqscDevice has been deleted');
    this.homey.app.events.removeListener("deviceUpdateSC", this.onDeviceUpdateSCHandler);
  }

  async setSaltLevel(saltLevel){
    await this.setCapabilityValue('measure_salt_level', saltLevel).catch(this.error);
  }

}

module.exports = softliqscDevice;
