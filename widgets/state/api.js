'use strict';

module.exports = {

    async getDeviceData({ homey, query }) {
        return await homey.app.apiGetDeviceData( query.driver_id, query.device_id );
    }
};