'use strict';

const { Device } = require('homey');

class softliqsdDevice extends Device {
  /**
   * onInit is called when the device is initialized.
   */
    async onInit() {
        this.log('softliqsdDevice has been initialized');

        await this.updateCapabilities();

        // register eventhandler for device updates
        this.onDeviceUpdateStatisticsHandler = this.onDeviceUpdateStatistics.bind(this);
        this.onDeviceUpdateParametersHandler = this.onDeviceUpdateParameters.bind(this);
        this.onDeviceUpdateDataHandler = this.onDeviceUpdateData.bind(this);
        this.homey.app.events.on("deviceUpdateStatics", this.onDeviceUpdateStatisticsHandler);
        this.homey.app.events.on("deviceUpdateParameters", this.onDeviceUpdateParametersHandler);
        this.homey.app.events.on("deviceUpdateData", this.onDeviceUpdateDataHandler);

        // register eventhandler for maintenance buttons
        this.registerCapabilityListener('button.reset_measure_salt_level', this.resetSaltLevel.bind(this));
        this.registerCapabilityListener('button.refresh', this.devicesRefresh.bind(this));
        this.registerCapabilityListener('button.regeneration', this.startRegeneration.bind(this));
        // register eventhandler for capability changes (setable capabilities)
        this.registerCapabilityListener('measure_salt_level', this.setSaltLevel.bind(this));
      }

    async updateCapabilities(){
      // Add new capabilities (if not already added)
      // add new capabilities for version 1.0.4
      if (!this.hasCapability('measure_reg_progress_text'))
      {
        await this.addCapability('measure_reg_progress_text');
      }
      if (!this.hasCapability('measure_reg_progress_description'))
      {
        await this.addCapability('measure_reg_progress_description');
      }
      if (!this.hasCapability('measure_reg_progress'))
      {
        await this.addCapability('measure_reg_progress');
      }
      if (!this.hasCapability('measure_reg_remaining_step'))
      {
        await this.addCapability('measure_reg_remaining_step');
      }
      if (!this.hasCapability('button.refresh'))
      {
        await this.addCapability('button.refresh');
      }
      // add new capabilities for version 1.1.0
      if (!this.hasCapability('button.regeneration'))
      {
        await this.addCapability('button.regeneration');
      }
      // add new capabilities for version 1.1.1
      if (!this.hasCapability('measure_reg_remaining_step_description'))
      {
        await this.addCapability('measure_reg_remaining_step_description');
      }
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

    async onDeviceUpdateParameters(deviceSerialNumber, data){
      if( this.getData().serialNumber != deviceSerialNumber ){
          // event is not valid for this device
          return;
      }
      // Write device parameters into settings

      if ( this.getSetting('working_mode') != data.pmode.toString() ){ 
        let settings = {
          working_mode: data.pmode.toString()
        };
        this.setSettings(settings);
      }
      if ( this.getSetting('working_mode_mo') != data.pmodemo.toString() ){ 
        let settings = {
          working_mode_mo: data.pmodemo.toString()
        };
        this.setSettings(settings);
      }
      if ( this.getSetting('working_mode_tu') != data.pmodetu.toString() ){ 
        let settings = {
          working_mode_tu: data.pmodetu.toString()
        };
        this.setSettings(settings);
      }
      if ( this.getSetting('working_mode_we') != data.pmodewe.toString() ){ 
        let settings = {
          working_mode_we: data.pmodewe.toString()
        };
        this.setSettings(settings);
      }
      if ( this.getSetting('working_mode_th') != data.pmodeth.toString() ){ 
        let settings = {
          working_mode_th: data.pmodeth.toString()
        };
        this.setSettings(settings);
      }
      if ( this.getSetting('working_mode_fr') != data.pmodefr.toString() ){ 
        let settings = {
          working_mode_fr: data.pmodefr.toString()
        };
        this.setSettings(settings);
      }
      if ( this.getSetting('working_mode_sa') != data.pmodesa.toString() ){ 
        let settings = {
          working_mode_sa: data.pmodesa.toString()
        };
        this.setSettings(settings);
      }
      if ( this.getSetting('working_mode_su') != data.pmodesu.toString() ){ 
        let settings = {
          working_mode_su: data.pmodesu.toString()
        };
        this.setSettings(settings);
      }
      if ( this.getSetting('reg_mode') != data.pregmode.toString() ){ 
        let settings = {
          reg_mode: data.pregmode.toString()
        };
        this.setSettings(settings);
      }
      if ( this.decimalToString(this.getSetting('reg_mode_hours')) != data.pregmo1.split(':')[0] ){ 
        let settings = {
          reg_mode_hours: parseInt(data.pregmo1.split(':')[0])
        };
        this.setSettings(settings);
      }
      if ( this.decimalToString(this.getSetting('reg_mode_minutes')) != data.pregmo1.split(':')[1] ){ 
        let settings = {
          reg_mode_minutes: parseInt(data.pregmo1.split(':')[1])
        };
        this.setSettings(settings);
      }
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
        //await this.setCapabilityValue('meter_water.remaining_capacity', parseInt( parseFloat(data.mrescapa1) * 1000) / 1000 ).catch(this.error);
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
        let regStatus = 0;
        let regRemaining = '-';
        let minutes = 0;
        let seconds = 0;
        switch(parseInt( data.mregstatus)){
          case 0:
            regStatus = 0;
            await this.setCapabilityValue('measure_reg_progress_text', '00' ).catch(this.error);
            await this.setCapabilityValue('measure_reg_progress_description', this.homey.__('capabilityCaption.regProgressDescription00') ).catch(this.error);
            break;
          case 10:
            regStatus = 20;
            await this.setCapabilityValue('measure_reg_progress_text', '01' ).catch(this.error);
            await this.setCapabilityValue('measure_reg_progress_description', this.homey.__('capabilityCaption.regProgressDescription01') ).catch(this.error);
            regRemaining = (Math.round(parseFloat(data.mremregstep) * 100 ) / 100).toString() + ' l';
            break;
          case 20:
            regStatus = 40;
            await this.setCapabilityValue('measure_reg_progress_text', '02' ).catch(this.error);
            await this.setCapabilityValue('measure_reg_progress_description', this.homey.__('capabilityCaption.regProgressDescription02') ).catch(this.error);
            minutes = parseInt(parseInt(data.mremregstep) /60 );
            seconds = parseInt(data.mremregstep) - (minutes * 60);
            regRemaining = minutes + ':' + seconds + ' min';
            break;
          case 30:
            regStatus = 60;
            await this.setCapabilityValue('measure_reg_progress_text', '03' ).catch(this.error);
            await this.setCapabilityValue('measure_reg_progress_description', this.homey.__('capabilityCaption.regProgressDescription03') ).catch(this.error);
            minutes = parseInt(parseInt(data.mremregstep) /60 );
            seconds = parseInt(data.mremregstep) - (minutes * 60);
            regRemaining = minutes + ':' + seconds + ' min';
            break;
          case 40:
            regStatus = 80;
            await this.setCapabilityValue('measure_reg_progress_text', '04' ).catch(this.error);
            await this.setCapabilityValue('measure_reg_progress_description', this.homey.__('capabilityCaption.regProgressDescription04') ).catch(this.error);
            regRemaining = (Math.round(parseFloat(data.mremregstep) * 100 ) / 100).toString() + ' l';
            break;
          case 60:
            await this.setCapabilityValue('measure_reg_progress_text', '05' ).catch(this.error);
            await this.setCapabilityValue('measure_reg_progress_description', this.homey.__('capabilityCaption.regProgressDescription05') ).catch(this.error);
            regStatus = 90;
            regRemaining = (Math.round(parseFloat(data.mremregstep) * 100 ) / 100).toString() + ' l';
            break;
          case 50:
            await this.setCapabilityValue('measure_reg_progress_text', '05' ).catch(this.error);
            await this.setCapabilityValue('measure_reg_progress_description', this.homey.__('capabilityCaption.regProgressDescription05') ).catch(this.error);
            regStatus = 100;
            regRemaining = (Math.round(parseFloat(data.mremregstep) * 100 ) / 100).toString() + ' l';
            break;
          }
        await this.setCapabilityValue('measure_reg_progress', regStatus).catch(this.error);
        await this.setCapabilityValue('measure_reg_remaining_step', parseFloat(data.mremregstep) ).catch(this.error);

        // TEST Minutenangabe
        // data.mremregstep = '1234';
        // minutes = parseInt(parseInt(data.mremregstep) /60 );
        // seconds = parseInt(data.mremregstep) - (minutes * 60);
        // regRemaining = minutes + ':' + seconds + ' min';

        // TEST Literangabe
        // data.mremregstep = '12.5678';
        // regRemaining = (Math.round(parseFloat(data.mremregstep) * 100 ) / 100).toString() + ' l';

        await this.setCapabilityValue('measure_reg_remaining_step_description', regRemaining ).catch(this.error);
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
    // this.log('Changed Setings: ');
    // this.log(changedKeys);
    // this.log('New Setings: ');
    // this.log(newSettings);
    if ( oldSettings.working_mode != newSettings.working_mode ){
      // this.log("Changed parameter: working_mode");
      await this.homey.app.deviceSetParameter(this.getData().id, "pmode", parseInt(newSettings.working_mode))
    }
    if ( oldSettings.working_mode_mo != newSettings.working_mode_mo ){
      // this.log("Changed parameter: working_mode_mo");
      await this.homey.app.deviceSetParameter(this.getData().id, "pmodemo", parseInt(newSettings.working_mode_mo))
    }
    if ( oldSettings.working_mode_tu != newSettings.working_mode_tu ){
      // this.log("Changed parameter: working_mode_tu");
      await this.homey.app.deviceSetParameter(this.getData().id, "pmodetu", parseInt(newSettings.working_mode_tu))
    }
    if ( oldSettings.working_mode_we != newSettings.working_mode_we ){
      // this.log("Changed parameter: working_mode_we");
      await this.homey.app.deviceSetParameter(this.getData().id, "pmodewe", parseInt(newSettings.working_mode_we))
    }
    if ( oldSettings.working_mode_th != newSettings.working_mode_th ){
      // this.log("Changed parameter: working_mode_tu");
      await this.homey.app.deviceSetParameter(this.getData().id, "pmodeth", parseInt(newSettings.working_mode_th))
    }
    if ( oldSettings.working_mode_fr != newSettings.working_mode_fr ){
      // this.log("Changed parameter: working_mode_fr");
      await this.homey.app.deviceSetParameter(this.getData().id, "pmodefr", parseInt(newSettings.working_mode_fr))
    }
    if ( oldSettings.working_mode_sa != newSettings.working_mode_sa ){
      // this.log("Changed parameter: working_mode_sa");
      await this.homey.app.deviceSetParameter(this.getData().id, "pmodesa", parseInt(newSettings.working_mode_sa))
    }
    if ( oldSettings.working_mode_su != newSettings.working_mode_su ){
      // this.log("Changed parameter: working_mode_su");
      await this.homey.app.deviceSetParameter(this.getData().id, "pmodesu", parseInt(newSettings.working_mode_su))
    }
    if ( oldSettings.reg_mode != newSettings.reg_mode ){
      // this.log("Changed parameter: reg_mode");
      await this.homey.app.deviceSetParameter(this.getData().id, "pregmode", parseInt(newSettings.reg_mode))
    }
    if ( oldSettings.reg_mode_hours != newSettings.reg_mode_hours || 
         oldSettings.reg_mode_minutes != newSettings.reg_mode_minutes ){
      // this.log("Changed parameter: reg_mode_hours / reg_mode_minutes");
      await this.homey.app.deviceSetParameter(this.getData().id, "pregmo1", this.decimalToString(newSettings.reg_mode_hours) +':'+ this.decimalToString(newSettings.reg_mode_minutes))
    }
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
    this.homey.app.events.removeListener("deviceUpdateData", this.onDeviceUpdateDataHandler);
    this.homey.app.events.removeListener("deviceUpdateParameters", this.onDeviceUpdateParametersHandler);
    this.homey.app.events.removeListener("deviceUpdateStatics", this.onDeviceUpdateStatisticsHandler);
    this.log('softliqsdDevice has been deleted');
  }

  async setSaltLevel(saltLevel){
    await this.setCapabilityValue('measure_salt_level', saltLevel).catch(this.error);
  }

  async startRegeneration(){
    await this.homey.app.deviceStartRegeneration(this.getData().id);
  }

  async devicesRefresh(){
    await this.homey.app.devicesUpdate().catch(this.error);
  }

  decimalToString(number){
    let string = number.toString();
    if (string.length == 1){
      string = '0' + string;
    }
    return string;
  }

}

module.exports = softliqsdDevice;
