module.exports = {
    async loginTest({ homey, query })
    {
        return await homey.app.loginTest();
    },
    async getDetect({ homey, query })
    {
        return homey.app.detectedDevices;
    },
    async clearLog({ homey, body })
    {
        homey.app.diagLog = "";
        return "OK";
    },
    async getLog({ homey, query })
    {
        return homey.app.diagLog;
    }
};