'use strict';

const { Driver } = require('homey');

class softliqsdDriver extends Driver {
  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('softliqsdDriver has been initialized');
  }

  /**
   * onPairListDevices is called when a user is adding a device and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async onPairListDevices() {
    const searchData = await this.homey.app.getDevices(true);
    // Create an array of devices
    let data = {};
    const devices = [];
    if (searchData){
      for (const device of searchData)
      {
        // Filter: only softliQ.D allowed
        if (device.series == "softliQ.D"){  
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

module.exports = softliqsdDriver;