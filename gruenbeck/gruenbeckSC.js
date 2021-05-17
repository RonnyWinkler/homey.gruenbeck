'use strict';

const { XMLHttpRequest } = require("xmlhttprequest-ts");

class GruenbeckSCSrv{

    constructor() {
        //super();
        this.requestAllCommand =
            "id=0000&code=245&show=D_D_1|D_A_4_1|D_A_4_2|D_A_4_3|D_C_1_1|D_C_2_1|D_C_5_1|D_C_4_1|D_C_4_2|D_C_4_3|D_C_6_1|D_C_7_1|D_A_2_2|D_A_2_3|D_C_3_6_1|D_C_8_1|D_C_8_2|D_C_3_6_2|D_C_3_6_3|D_C_3_6_4|D_C_3_6_5|D_C_3_7_1|D_C_3_7_2|D_C_3_7_3|D_Y_5|D_Y_7|D_Y_6|D_Y_8_11|D_Y_10_1|D_B_1|D_A_1_1|D_A_1_2|D_A_1_3|D_A_2_1|D_A_3_1|D_A_3_2|D_K_1|D_K_2|D_K_3|D_K_4|D_K_7|D_K_8|D_K_9|D_Y_2_1|D_Y_4_1|D_Y_2_2|D_Y_4_2|D_Y_2_3|D_Y_4_3|D_Y_2_4|D_Y_4_4|D_Y_2_5|D_Y_4_5|D_Y_2_6|D_Y_4_6|D_Y_2_7|D_Y_4_7|D_Y_2_8|D_Y_4_8|D_Y_2_9|D_Y_4_9|D_Y_2_10|D_Y_4_10|D_Y_2_11|D_Y_4_11|D_Y_2_12|D_Y_4_12|D_Y_2_13|D_Y_4_13|D_Y_2_14|D_Y_4_14~";
        this.requestActualsCommand =
            "id=0000&show=D_A_1_1|D_A_1_2|D_A_2_2|D_A_3_1|D_A_3_2|D_Y_1|D_A_1_3|D_A_2_3|D_Y_5|D_A_2_1|D_C_4_1|D_C_4_3|D_C_1_1|D_C_4_2|D_C_5_1|D_C_6_1|D_C_8_1|D_C_8_2|D_D_1|D_E_1|D_Y_9|D_Y_9_8|D_Y_9_24|D_C_7_1|D_Y_10_1|D_B_1~";
        this.requestErrorsCommand =
            "id=0000&code=245&show=D_K_10_1|D_K_10_2|D_K_10_3|D_K_10_4|D_K_10_5|D_K_10_6|D_K_10_7|D_K_10_8|D_K_10_9|D_K_10_10|D_K_10_11|D_K_10_12|D_K_10_13|D_K_10_14|D_K_10_15|D_K_10_16~";
        this.requestImpulsCommand = "id=0000&code=290&show=D_F_5|D_F_6~";
        this.requestDurchflussCommand = "id=0000&show=D_A_1_1~";

    }
    
    requestDataSC(ipAddress, command){
        return new Promise((resolve, reject) => {
            let log = "";
            let currentCommand = this.requestAllCommand;
            const xhr = new XMLHttpRequest();
            if (!command)
                currentCommand = this.requestAllCommand;
            //console.log(currentCommand);
            try {
                //console.log("sendRequest ");
                log += "SD sendRequest http://"+ ipAddress + "/mux_http\r\n";
                //console.log("http://" + ipAddress + "/mux_http");
                xhr.open("POST", "http://" + ipAddress + "/mux_http", true);
                xhr.setRequestHeader("Content-type", "application/json");
                xhr.timeout = 10 * 1000;
                //xhr.timeout = (this.config.pollInterval - 1 > 1 ? this.config.pollInterval - 1 : 1) * 1000;
                xhr.send(currentCommand);
                xhr.ontimeout = (error) => {
                    //xhr.abort();
                    //console.log(error.message);
                    log += "Timeout\r\n";
                    log += error.message;
                    //reject(error.message);
                    reject(log);
                };
                xhr.onload = () => {
                    //console.log("onload");
                    //console.log(xhr.responseText);
                    //log += "OnLoad "+xhr.responseText+"\r\n";
                    if (xhr.responseText) {
                        //this.parseData(domParser.parseFromString(xhr.responseText, "text/xml"));
                        var response = xhr.responseText;
                        resolve(response);
                    }
                };
                xhr.onreadystatechange = () => {
                    // 0 UNSENT - open()has not been called yet
                    // 1 OPENED - send()has not been called yet
                    // 2 HEADERS_RECEIVED - send() has been called, and headers and status are available
                    // 3 LOADING Downloading; - responseText holds partial data
                    // 4 - The operation is complete
                    //console.log("statechange: " + xhr.readyState + " " + xhr.responseText.length);
                    //console.log(xhr.responseText);
                    log += "StatusChange "+xhr.readyState+"\r\n";
                    log += xhr.responseText+"\r\n";
                    if (xhr.readyState === 4) {
                        if (xhr.responseText.length === 0 || xhr.responseText.indexOf("Error: ") != -1) {
                            if (xhr.responseText.length === 0) {
                                //console.log("Device returns empty repsonse. Resend request.");
                                log += "Device returns empty repsonse. Resend request.\r\n";
                                reject(log);
                            };
                            log += "Device cannot handle new connections this is normal.\r\n";
                            reject(log);
                        }
                    }
                };
             } catch (error) {
                xhr.abort();
                //console.log(error);
                reject(error);
            }
        });
    }
}

module.exports = GruenbeckSCSrv;