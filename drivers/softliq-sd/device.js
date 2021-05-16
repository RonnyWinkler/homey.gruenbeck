'use strict';

const { Device } = require('homey');

class softliqsdDevice extends Device {
  /**
   * onInit is called when the device is initialized.
   */
    async onInit() {
        this.log('softliqsdDevice has been initialized');

        // register eventhandler for device updates
        this.homey.app.events.on("deviceUpdateStatics", this.onDeviceUpdateStatistics.bind(this));
        this.homey.app.events.on("deviceUpdateData", this.onDeviceUpdateData.bind(this));

        // register eventhandler for maintenance buttons
        this.registerCapabilityListener('button.reset_measure_salt_level', this.resetSaltLevel.bind(this));
    }

    async resetSaltLevel(){
        const settings = this.getSettings();
        return await this.setCapabilityValue('measure_salt_level', settings.salt_level ).catch(this.error);
    }

    async onDeviceUpdateStatistics(deviceSerialNumber, data){
        if( this.getData().serialNumber != deviceSerialNumber ){
            // event is not valid for this device
            return;
        }
        // calculate salt level
        if (this.getCapabilityValue('measure_last_saltusage') != data.salt[0].value ){
            let new_salt_level = ( Math.round( this.getCapabilityValue('measure_salt_level') * 1000 - (data.salt[0].value) ) ) /1000;
            await this.setCapabilityValue('measure_salt_level', new_salt_level).catch(this.error); 
        }
        await this.setCapabilityValue('measure_last_waterusage', data.water[0].value).catch(this.error);
        await this.setCapabilityValue('measure_last_saltusage', data.salt[0].value).catch(this.error);
    }

    async onDeviceUpdateData(deviceSerialNumber, data){
        if( this.getData().serialNumber != deviceSerialNumber ){
            // event is not valid for this device
            return;
        }
        if (data.type == "CurrSlow"){
            await this.setCapabilityValue('meter_water', parseInt( data.mcountwater1 ) ).catch(this.error);
            await this.setCapabilityValue('meter_salt', parseFloat( data.msaltusage ) ).catch(this.error);            
        }
        if (data.type == "Current"){
            await this.setCapabilityValue('measure_remaining_capacity', parseInt( parseFloat(data.mrescapa1) * 1000) ).catch(this.error);
            await this.setCapabilityValue('measure_last_reg_percent', parseInt(data.mregpercent1) ).catch(this.error);
            //Regeneration is active if mregstatus <> 0
            await this.setCapabilityValue('alarm_regeneration_active', (data.mregstatus != 0) ).catch(this.error);
            // last changed date/time
            //var date = new Date().toISOString().replace("T", " ").split(".")[0];
            const tz  = this.homey.clock.getTimezone();
            const now = new Date().toLocaleString('de-DE', 
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
            }
    }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('softliqsdDevice has been added');

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
    this.log('softliqsdDevice settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.log('softliqsdDevice was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('softliqsdDevice has been deleted');
  }

  async setSaltLevel(saltLevel){
    await this.setCapabilityValue('measure_salt_level', saltLevel).catch(this.error);
  }

}

module.exports = softliqsdDevice;
