var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { question } from "readline-sync";
import { Amplify, Auth } from "aws-amplify";
import { readFileSync, writeFileSync } from "fs";
export function readConfigFile() {
    try {
        const content = readFileSync("./sqc.json").toString();
        return JSON.parse(content);
    }
    catch (_e) {
        return {};
    }
}
export function writeConfigFile(cfg) {
    const buf = JSON.stringify(cfg, null, 4);
    writeFileSync("./sqc.json", buf);
}
export function authenticateAMS() {
    var _a, _b, _c, _d;
    return __awaiter(this, void 0, void 0, function* () {
        const cfg = readConfigFile();
        if (!cfg.ams) {
            cfg.ams = {};
        }
        if (!((_a = cfg.ams) === null || _a === void 0 ? void 0 : _a.region)) {
            cfg.ams.region = question("AWS Region: ");
        }
        if (!((_b = cfg.ams) === null || _b === void 0 ? void 0 : _b.poolId)) {
            cfg.ams.poolId = question("Pool ID: ");
        }
        if (!((_c = cfg.ams) === null || _c === void 0 ? void 0 : _c.clientId)) {
            cfg.ams.clientId = question("Client ID: ");
        }
        if (!((_d = cfg.ams) === null || _d === void 0 ? void 0 : _d.username)) {
            cfg.ams.username = question("AMS Username: ");
        }
        const password = question("AMS Password: ", { hideEchoBack: true });
        const AwsConfigAuth = {
            region: cfg.ams.region,
            userPoolId: cfg.ams.poolId,
            userPoolWebClientId: cfg.ams.clientId,
            cookieStorage: {
                domain: "localhost",
                path: "/",
                expires: 365,
                sameSite: "strict",
                secure: true,
            },
            authenticationFlowType: "USER_SRP_AUTH",
        };
        Amplify.configure({ Auth: AwsConfigAuth });
        let user = yield Auth.signIn(cfg.ams.username, password);
        if (user.challengeName) {
            const code = question("OTP: ", { hideEchoBack: true });
            user = yield Auth.confirmSignIn(user, code, user.challengeName);
        }
        cfg.ams.session = user.getSignInUserSession().getIdToken().getJwtToken();
        writeConfigFile(cfg);
    });
}
export function authenticateSolarNetwork() {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        const cfg = readConfigFile();
        if (!cfg.sn) {
            cfg.sn = {};
        }
        if (!((_a = cfg.sn) === null || _a === void 0 ? void 0 : _a.token)) {
            cfg.sn.token = question("SolarNetwork Token: ");
        }
        if (!((_b = cfg.sn) === null || _b === void 0 ? void 0 : _b.secret)) {
            cfg.sn.secret = question("SolarNetwork Secret: ");
        }
        writeConfigFile(cfg);
    });
}
