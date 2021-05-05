'use strict';

const { Driver } = require('homey');

class softliqsdDriver extends Driver {
  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('softliqsdDriver has been initialized');

    let regeneratingCondition = this.homey.flow.getConditionCard('is_regenerating');
    regeneratingCondition.registerRunListener(async (args, state) =>
    {
        return args.device.getCapabilityValue('is_regenerating'); // true or false
    });

    const setSaltLevel = this.homey.flow.getActionCard('set_salt_level');
    setSaltLevel
        .registerRunListener(async (args, state) =>
        {
            return args.device.setSaltLevel(args.salt_level);
        });

  }

  /**
   * onPairListDevices is called when a user is adding a device and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async onPairListDevices() {
    return this.homey.app.getDevices(true);
    //return [
      // Example device data, note that `store` is optional
      // {
      //   name: 'My Device',
      //   data: {
      //     id: 'my-device',
      //   },
      //   store: {
      //     address: '127.0.0.1',
      //   },
      // },
    //];
  }
}

module.exports = softliqsdDriver;