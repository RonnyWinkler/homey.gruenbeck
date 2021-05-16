'use strict';

const axios = require("axios");
const querystring = require("querystring");
const crypto = require("crypto");
const WebSocket = require("ws");
const { resolve } = require("path");
const EventEmitter = require('events');

class GruenbeckSDSrv extends EventEmitter{

    constructor() {
        super();

        this.sdVersion = "2020-08-03";
        this.userAgent = "Gruenbeck/354 CFNetwork/1209 Darwin/20.2.0";
        this.heartBeatTimeout = null;
    
        this.refreshToken = "";
        this.accessToken = "";
        this.wsAccessToken = "";
        this.wsUrl = "";
        this.wsConnectionId = "";
        this.tenant = "";
        this.connected = false;

        // websocket instance
        this.ws = null;

        this.user = "";
        this.password = "";
    }

    login(user, password) {
        //console.log("===== Login =====");
        if (user)
            this.user = user;
        if (password)
            this.password = password;
        if (!this.user || !this.password){
            //console.log("User/assword not set.");
          return false;
        }
        return new Promise((resolve, reject) => {
          this.connected = false;
            const [code_verifier, codeChallange] = this.getCodeChallenge();
            const axiosInitConfig = {
                headers: {
                    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Encoding": "br, gzip, deflate",
                    Connection: "keep-alive",
                    "Accept-Language": "de-de",
                    "User-Agent": this.userAgent
                },
            };
            //console.log("Login Step 1 - GET:");
            //console.log("https://gruenbeckb2c.b2clogin.com/a50d35c1-202f-4da7-aa87-76e51a3098c6/b2c_1a_signinup/oauth2/v2.0/authorize?" +
            //"x-client-Ver=0.8.0&state=NjkyQjZBQTgtQkM1My00ODBDLTn3MkYtOTZCQ0QyQkQ2NEE5&client_info=1&response_type=code&code_challenge_method=S256&x-app-name=Gr%C3%BCnbeck&x-client-OS=14.3&x-app-ver=1.2.1&scope=https%3A%2F%2Fgruenbeckb2c.onmicrosoft.com%2Fiot%2Fuser_impersonation%20openid%20profile%20offline_access&x-client-SKU=MSAL.iOS&" +
            //"code_challenge=" +
            //codeChallange +
            //"&x-client-CPU=64&client-request-id=F2929DED-2C9D-49F5-A0F4-31215427667C&redirect_uri=msal5a83cc16-ffb1-42e9-9859-9fbf07f36df8%3A%2F%2Fauth&client_id=5a83cc16-ffb1-42e9-9859-9fbf07f36df8&haschrome=1&return-client-request-id=true&x-client-DM=iPhone")
            axios
                .get( 
                    "https://gruenbeckb2c.b2clogin.com/a50d35c1-202f-4da7-aa87-76e51a3098c6/b2c_1a_signinup/oauth2/v2.0/authorize?" +
                        "x-client-Ver=0.8.0&state=NjkyQjZBQTgtQkM1My00ODBDLTn3MkYtOTZCQ0QyQkQ2NEE5&client_info=1&response_type=code&code_challenge_method=S256&x-app-name=Gr%C3%BCnbeck&x-client-OS=14.3&x-app-ver=1.2.1&scope=https%3A%2F%2Fgruenbeckb2c.onmicrosoft.com%2Fiot%2Fuser_impersonation%20openid%20profile%20offline_access&x-client-SKU=MSAL.iOS&" +
                        "code_challenge=" +
                        codeChallange +
                        "&x-client-CPU=64&client-request-id=F2929DED-2C9D-49F5-A0F4-31215427667C&redirect_uri=msal5a83cc16-ffb1-42e9-9859-9fbf07f36df8%3A%2F%2Fauth&client_id=5a83cc16-ffb1-42e9-9859-9fbf07f36df8&haschrome=1&return-client-request-id=true&x-client-DM=iPhone",
                    axiosInitConfig
                )
                .then((response) => {
                    //console.log("Login step 1 - OK");
                    //console.log(JSON.stringify(response.data));
                    // handle success
                    let start, end;
                    start = response.data.indexOf("csrf") + 7;
                    end = response.data.indexOf(",", start) - 1;
                    const csrf = response.data.substring(start, end);
                    //console.log("csrf: " + csrf);
                    start = response.data.indexOf("transId") + 10;
                    end = response.data.indexOf(",", start) - 1;
                    const transId = response.data.substring(start, end);
                    //console.log("transId: " + transId);
                    start = response.data.indexOf("policy") + 9;
                    end = response.data.indexOf(",", start) - 1;
                    const policy = response.data.substring(start, end);
                    //console.log("policy: " + policy);
                    start = response.data.indexOf("tenant") + 9;
                    end = response.data.indexOf(",", start) - 1;
                    //console.log("tenant start:"+start+" end:"+end);
                    this.tenant = response.data.substring(start, end);
                    //console.log("tenant: " + this.tenant);
                    const filteredCookies = response.headers["set-cookie"].map((element) => {
                        return element.split("; ")[0];
                    });
                    //console.log("filteredCookies: " + filteredCookies);
                    const cookie = filteredCookies.join("; ");
                    //console.log("Cookie: " + cookie);
    
                    const axiosConfig = {
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                            "X-CSRF-TOKEN": csrf,
                            Accept: "application/json, text/javascript, */*; q=0.01",
                            "X-Requested-With": "XMLHttpRequest",
                            Origin: "https://gruenbeckb2c.b2clogin.com",
    
                            Cookie: cookie,
                            "User-Agent": this.userAgent,
                        },
                    };
                    //console.log("Login Step 2 - POST:");
                    //console.log("https://gruenbeckb2c.b2clogin.com" + this.tenant + "/SelfAsserted?tx=" + transId + "&p=" + policy);
                    axios
                        .post(
                            "https://gruenbeckb2c.b2clogin.com" + this.tenant + "/SelfAsserted?tx=" + transId + "&p=" + policy,
                            querystring.stringify({
                                request_type: "RESPONSE",
                                signInName: this.user,
                                password: this.password,
                            }),
                            axiosConfig
                        )
                        .then((response) => {
                            //console.log("Login step 2");
                            //console.log(JSON.stringify(response.data));
                            if (response && response.data.status != 200)
                                reject(response.data);
                            const filteredCookies = response.headers["set-cookie"].map((element) => {
                                return element.split("; ")[0];
                            });
                            let cookie = filteredCookies.join("; ");
                            cookie += "; x-ms-cpim-csrf=" + csrf;
                            const axiosGetConfig = {
                                maxRedirects: 0,
                                headers: {
                                    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                                    "Accept-Encoding": "br, gzip, deflate",
                                    Connection: "keep-alive",
                                    "Accept-Language": "de-de",
                                    Cookie: cookie,
                                    "User-Agent": this.userAgent,
                                },
                            };
                            axios
                                .get("https://gruenbeckb2c.b2clogin.com" + this.tenant + "/api/CombinedSigninAndSignup/confirmed?csrf_token=" + csrf + "&tx=" + transId + "&p=" + policy, axiosGetConfig)
                                .then((response) => {
                                    //console.log(response);
                                })
                                .catch((error) => {
                                    // handle error
                                    if (error.response && error.response.status === 302) {
                                        if (error.response.data.indexOf("code") !== -1) {
                                            start = error.response.data.indexOf("code%3d") + 7;
                                            end = error.response.data.indexOf(">here") - 1;
                                            const code = error.response.data.substring(start, end);
                                            const axiosPostConfig = {
                                                maxRedirects: 0,
                                                headers: {
                                                    Host: "gruenbeckb2c.b2clogin.com",
                                                    "x-client-SKU": "MSAL.iOS",
                                                    Accept: "application/json",
                                                    "x-client-OS": "14.3",
                                                    "x-app-name": "Grünbeck",
                                                    "x-client-CPU": "64",
                                                    "x-app-ver": "1.2.0",
                                                    "Accept-Language": "de-de",
                                                    "client-request-id": "F2929DED-2C9D-49F5-A0F4-31215427667C",
                                                    "x-ms-PkeyAuth": "1.0",
                                                    "x-client-Ver": "0.8.0",
                                                    "x-client-DM": "iPhone",
                                                    "User-Agent": "Gruenbeck/354 CFNetwork/1209 Darwin/20.2.0",
                                                    "return-client-request-id": "true",
                                                },
                                            };
                                            axios
                                                .post(
                                                    "https://gruenbeckb2c.b2clogin.com" + this.tenant + "/oauth2/v2.0/token",
                                                    querystring.stringify({
                                                        client_info: "1",
                                                        scope: "https://gruenbeckb2c.onmicrosoft.com/iot/user_impersonation openid profile offline_access",
                                                        code: code,
                                                        grant_type: "authorization_code",
                                                        code_verifier: code_verifier,
                                                        redirect_uri: "msal5a83cc16-ffb1-42e9-9859-9fbf07f36df8://auth",
                                                        client_id: "5a83cc16-ffb1-42e9-9859-9fbf07f36df8",
                                                    }),
                                                    axiosPostConfig
                                                )
                                                .then((response) => {
                                                    this.accessToken = response.data.access_token;
                                                    //console.log("accessToken: "+this.accessToken);
                                                    this.refreshToken = response.data.refresh_token;
                                                    //console.log("refreshToken: "+this.refreshToken);
                                                    setInterval(() => this.startRefreshToken(), 50 * 60 * 1000); //50min
                                                    //this.setState("info.connection", true, true);
                                                    this.connected = true;
                                                    //console.log("Login OK");
                                                    resolve();
                                                })
                                                .catch((error) => {
                                                    // handle error
                                                    //console.log(error);
                                                    reject(error);
                                                });
                                        }
                                    } else {
                                        //console.log("LoginError");
                                        //console.log(error);
                                        reject(error);
                                    }
                                });
                        })
                        .catch((error) => {
                            // handle error
                            //console.log("Error Step 2");
                            //console.log(error);
                            reject(error);
                        });
                })
                .catch((error) => {
                    // handle error
                    //console.log("Error Step 1");
                    //console.log(JSON.stringify(error));
                    reject(error);
                });
        });
      }
    
      getMgDevices() {
        //console.log("===== Get Devices =====");
        return new Promise((resolve, reject) => {
            const axiosConfig = {
                headers: {
                    Host: "prod-eu-gruenbeck-api.azurewebsites.net",
                    Accept: "application/json, text/plain, */*",
                    "User-Agent": "Gruenbeck/354 CFNetwork/1209 Darwin/20.2.0",
                    Authorization: "Bearer " + this.accessToken,
                    "Accept-Language": "de-de",
                    "cache-control": "no-cache",
                },
            };
            axios
                .get("https://prod-eu-gruenbeck-api.azurewebsites.net/api/devices?api-version=" + this.sdVersion, axiosConfig)
                .then(async (response) => {
                    if (response.data && response.data.length > 0) {
                        try {
                            //filter for softliq devices
                            //console.log(JSON.stringify(response.data));
                            response.data = response.data.filter((el) => el.series.toLowerCase().indexOf("softliq") > -1);
                            //console.log(JSON.stringify(response.data));
                            //this.homey.settings.set('detectedDevices', JSON.stringify(response.data));
                            //const device = response.data[0];
                            resolve(response.data);
                        } catch (error) {
                            //console.log(error);
                            //console.log(response.data);
                            reject(error);
                        }
                    } else {
                        reject("no data");
                    }
                })
                .catch((error) => {
                    //console.log(error);
                    reject(error);
                });
        });
      }

      startRefreshToken() {
        //console.log("===== Start Refresh Token =====");
        const axiosPostConfig = {
            maxRedirects: 0,
            headers: {
                Host: "gruenbeckb2c.b2clogin.com",
                "x-client-SKU": "MSAL.iOS",
                Accept: "application/json",
                "x-client-OS": "14.3",
                "x-app-name": "Grünbeck",
                "x-client-CPU": "64",
                "x-app-ver": "1.2.0",
                "Accept-Language": "de-de",
                "client-request-id": "F2929DED-2C9D-49F5-A0F4-31215427667C",
                "x-ms-PkeyAuth": "1.0",
                "x-client-Ver": "0.8.0",
                "x-client-DM": "iPhone",
                "User-Agent": "Gruenbeck/354 CFNetwork/1209 Darwin/20.2.0",
                "return-client-request-id": "true",
            },
        };
        axios
            .post(
                "https://gruenbeckb2c.b2clogin.com" + this.tenant + "/oauth2/v2.0/token",
                querystring.stringify({
                    client_id: "5a83cc16-ffb1-42e9-9859-9fbf07f36df8",
                    scope: "https://gruenbeckb2c.onmicrosoft.com/iot/user_impersonation openid profile offline_access",
                    refresh_token: this.refreshToken,
                    client_info: "1",
                    grant_type: "refresh_token",
                }),
                axiosPostConfig
            )
            .then((response) => {
                //console.log("Refresh Token succesfull");
                //console.log(JSON.stringify(response.data));
                this.accessToken = response.data.access_token;
                this.refreshToken = response.data.refresh_token;
                this.connected = true;
            })
            .catch((error) => {
                this.connected = false; 
                //console.log("Refreshtoken error");
                //console.log(error);
                setTimeout(() => this.startRefreshToken(), 5 * 60 * 1000);
            });
      }
    
      getCodeChallenge() {
        let hash = "";
        let result = "";
        while (hash === "" || hash.indexOf("+") !== -1 || hash.indexOf("/") !== -1 || hash.indexOf("=") !== -1 || result.indexOf("+") !== -1 || result.indexOf("/") !== -1) {
            const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
            result = "";
            for (let i = 64; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
            result = Buffer.from(result).toString("base64");
            result = result.replace(/=/g, "");
            hash = crypto.createHash("sha256").update(result).digest("base64");
            hash = hash.slice(0, hash.length - 1);
        }
        return [result, hash];
      }

      refreshSD(mgDeviceId) {
        return new Promise((resolve, reject) => {
            //console.log("===== refreshSD "+mgDeviceId+" =====");
            const axiosConfig = {
                headers: {
                    Host: "prod-eu-gruenbeck-api.azurewebsites.net",
                    Accept: "application/json, text/plain, */*",
                    "User-Agent": "Gruenbeck/354 CFNetwork/1209 Darwin/20.2.0",
                    "Accept-Language": "de-de",
                    Authorization: "Bearer " + this.accessToken,
                },
            };
            axios
                .post("https://prod-eu-gruenbeck-api.azurewebsites.net/api/devices/" + mgDeviceId + "/realtime/refresh?api-version=" + this.sdVersion, {}, axiosConfig)
                .then((response) => {
                    //console.log("refreshSD response:");
                    //console.log(JSON.stringify(response.data));
                    if (response.status < 400) {
                        //console.log("refreshSD OK");
                        resolve();
                    } else {
                        //console.log("refreshSD Error: "+response.status);
                        reject(response);
                    }
                })
                .catch((error) => {
                    // handle error
                    //console.log(error);
                    reject(error);
                });
        });
    }

    enterSD(mgDeviceId) {
        return new Promise((resolve, reject) => {
            //console.log("===== EnterSD "+mgDeviceId+" =====");
            const axiosConfig = {
                headers: {
                    Host: "prod-eu-gruenbeck-api.azurewebsites.net",
                    Accept: "application/json, text/plain, */*",
                    "User-Agent": "Gruenbeck/354 CFNetwork/1209 Darwin/20.2.0",
                    "Accept-Language": "de-de",
                    Authorization: "Bearer " + this.accessToken,
                },
            };
            axios
                .post("https://prod-eu-gruenbeck-api.azurewebsites.net/api/devices/" + mgDeviceId + "/realtime/enter?api-version=" + this.sdVersion, {}, axiosConfig)
                .then((response) => {
                    //console.log("enterSD response: "+JSON.stringify(response.data));
                    if (response.status < 400) {
                        this.heartBeatTimeout = setTimeout(() => {
                            console.log("No Data since 20 min start login");
                            this.login().then(() => {
                                console.log("Reconnect");
                                this.connectMgWebSocket();
                            });
                        }, 20 * 60 * 1000);
                        //console.log("enterSD OK");
                        resolve();
                    } else {
                        reject(response);
                    }
                })
                .catch((error) => {
                    // handle error
                    //console.log("EnterSD-Error: "+error);
                    reject(error);
                });
        });
    }

    leaveSD(mgDeviceId) {
        return new Promise((resolve, reject) => {
            //console.log("===== LeaveSD "+mgDeviceId+" =====");
            const axiosConfig = {
                headers: {
                    Host: "prod-eu-gruenbeck-api.azurewebsites.net",
                    Accept: "application/json, text/plain, */*",
                    "User-Agent": "Gruenbeck/354 CFNetwork/1209 Darwin/20.2.0",
                    "Accept-Language": "de-de",
                    Authorization: "Bearer " + this.accessToken,
                },
            };
            axios
                .post("https://prod-eu-gruenbeck-api.azurewebsites.net/api/devices/" + mgDeviceId + "/realtime/leave?api-version=" + this.sdVersion, {}, axiosConfig)
                .then((response) => {
                    //console.log("leaveSD response: "+JSON.stringify(response.data));
                    if (response.status < 400) {
                        //console.log("leaveSD OK");
                        resolve();
                    } else {
                        reject(response);
                    }
                })
                .catch((error) => {
                    // handle error
                    //console.log("LeaveSD-Error: "+error);
                    reject(error);
                });
        });
    }

    parseMgInfos(mgDeviceId, endpoint) {
        return new Promise((resolve, reject) => {
            endpoint = endpoint || "";
            const axiosConfig = {
                headers: {
                    Host: "prod-eu-gruenbeck-api.azurewebsites.net",
                    Accept: "application/json, text/plain, */*",
                    "User-Agent": this.userAgent,
                    Authorization: "Bearer " + this.accessToken,
                    "Accept-Language": "de-de",
                    "cache-control": "no-cache",
                },
            };
            //console.log("GET: " + "https://prod-eu-gruenbeck-api.azurewebsites.net/api/devices/" + mgDeviceId + "/" + endpoint + "?api-version=" + this.sdVersion);
            axios
                .get("https://prod-eu-gruenbeck-api.azurewebsites.net/api/devices/" + mgDeviceId + "/" + endpoint + "?api-version=" + this.sdVersion, axiosConfig)
                .then(async (response) => {
                    if (response.data) {
                        resolve(response.data);
                    } else {
                        reject("no data");
                    }
                })
                .catch((error) => {
                    //console.log(error);
                    reject(error);
                });
        });
    }

    connectMgWebSocket() {
        //console.log("===== connectMgWebSocket =====");
        this.closeMgWebSocket();
        const axiosConfig = {
            headers: {
                "Content-Type": "text/plain;charset=UTF-8",
                Origin: "file://",
                Accept: "*/*",
                "User-Agent": "Gruenbeck/354 CFNetwork/1209 Darwin/20.2.0",
                Authorization: "Bearer " + this.accessToken,
                "Accept-Language": "de-de",
                "cache-control": "no-cache",
                "X-Requested-With": "XMLHttpRequest",
            },
        };
        axios
            .get("https://prod-eu-gruenbeck-api.azurewebsites.net/api/realtime/negotiate", axiosConfig)
            .then((response) => {
                //console.log(JSON.stringify(response.data));
                if (response.data) {
                    this.wsUrl = response.data.url;
                    this.wsAccessToken = response.data.accessToken;
                    const axiosPostConfig = {
                        headers: {
                            "Content-Type": "text/plain;charset=UTF-8",
                            Origin: "file://",
                            Accept: "*/*",
                            "User-Agent": "Gruenbeck/354 CFNetwork/1209 Darwin/20.2.0",
                            Authorization: "Bearer " + this.wsAccessToken,
                            "Accept-Language": "de-de",
                            "X-Requested-With": "XMLHttpRequest",
                        },
                    };
                    axios
                        .post("https://prod-eu-gruenbeck-signalr.service.signalr.net/client/negotiate?hub=gruenbeck", {}, axiosPostConfig)
                        .then((response) => {
                            //console.log(JSON.stringify(response.data));
                            if (response.data) {
                                try {
                                    this.wsConnectionId = response.data.connectionId;

                                    this.ws = new WebSocket("wss://prod-eu-gruenbeck-signalr.service.signalr.net/client/?hub=gruenbeck&id=" + this.wsConnectionId + "&access_token=" + this.wsAccessToken, {
                                        headers: {
                                            Upgrade: "websocket",
                                            Host: "prod-eu-gruenbeck-signalr.service.signalr.net",
                                            Origin: "null",
                                            Pragma: "no-cache",
                                            "Cache-Control": "no-cache",

                                            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
                                        },
                                        perMessageDeflate: false
                                    });

                                    this.ws.on("open", async () => {
                                        //console.log("WS connected");
                                        this.ws.send('{"protocol":"json","version":1}');
                                    });
                                    this.ws.on("close", (data) => {
                                        //console.log(data);
                                        //console.log("Websocket closed");
                                    });
                                    this.ws.on("message", (data) => {
                                        //console.log("WS-Message: " +data);

                                        clearTimeout(this.heartBeatTimeout);
                                        //try {
                                            const message = JSON.parse(data.replace("", ""));
                                            // event on wsMessage from device
                                            this.emit('wsMessage', JSON.stringify(message));

                                        //} catch (error) {
                                        //    console.log("Websocket parse error");
                                        //    console.log(error);
                                        //    console.log(data);
                                        //    this.ws.close();
                                        //    setTimeout(() => {
                                        //        this.connectMgWebSocket();
                                        //    }, 5000);
                                        //}
                                    });
                                } catch (error) {
                                    console.log(error);
                                    console.log(response.data);
                                }
                            }
                        })
                        .catch((error) => {
                            // handle error
                            console.log(error);
                        });
                } else {
                }
            })
            .catch((error) => {
                // handle error
                console.log(error);
            });
        return;
    }

    closeMgWebSocket() {
        if (this.ws){
            //this.ws.removeEventListener("open");
            //this.ws.removeEventListener("close");
            //this.ws.removeEventListener("message");
            this.ws.removeAllListeners("open");
            this.ws.removeAllListeners("close");
            this.ws.removeAllListeners("message");
            
            this.ws.close();
            //this.ws.terminate();
            this.ws = null;
        }
    }

    isConnected(){
        return this.connected;
    }
}

module.exports = GruenbeckSDSrv;