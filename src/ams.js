var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { readConfigFile } from "./config.js";
export function listAMSProjects(codes) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const cfg = readConfigFile();
        if (!((_a = cfg.ams) === null || _a === void 0 ? void 0 : _a.session)) {
            throw new Error("Must have active AMS authentication");
        }
        const response = yield fetch("https://api.ecogytest.io/projects", {
            headers: {
                Authorization: cfg.ams.session
            }
        });
        if (response.status != 200) {
            throw new Error(`Failed to fetch export data, code: ${response.status}, message: ${response.statusText}`);
        }
        const fields = [
            "status",
            "name",
            "state",
            "code",
            "town",
            "timezone",
            "lat",
            "long"
        ];
        response.json().then(resp => {
            resp["projects"].forEach((p) => {
                if (codes) {
                    console.log(p["code"]);
                    return;
                }
                let v = {};
                for (const f of fields) {
                    v[f] = p[f];
                }
                console.table(v);
            });
        });
    });
}
export function listAMSSites(project) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const cfg = readConfigFile();
        if (!((_a = cfg.ams) === null || _a === void 0 ? void 0 : _a.session)) {
            throw new Error("Must have active AMS authentication");
        }
        const response = yield fetch("https://api.ecogytest.io/projects", {
            headers: {
                Authorization: cfg.ams.session
            }
        });
        if (response.status != 200) {
            throw new Error(`Failed to fetch export data, code: ${response.status}, message: ${response.statusText}`);
        }
        const r = yield response.json();
        const p = r["projects"].find((c) => c["code"] == project);
        const sites = p["sites"];
        Object.keys(sites).forEach((key) => {
            console.log(key);
        });
    });
}
export function listAMSSources(project, site) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const cfg = readConfigFile();
        if (!((_a = cfg.ams) === null || _a === void 0 ? void 0 : _a.session)) {
            throw new Error("Must have active AMS authentication");
        }
        const response = yield fetch("https://api.ecogytest.io/projects", {
            headers: {
                Authorization: cfg.ams.session
            }
        });
        if (response.status != 200) {
            throw new Error(`Failed to fetch export data, code: ${response.status}, message: ${response.statusText}`);
        }
        const r = yield response.json();
        const p = r["projects"].find((c) => c["code"] == project);
        const s = Object.values(p["sites"][site]["systems"]);
        let output = {};
        for (const system of s) {
            const code = system["code"];
            output[code] = system["devices"];
        }
        console.log(JSON.stringify(output, null, 4));
    });
}
export function listEvents(start, end) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const cfg = readConfigFile();
        if (!((_a = cfg.ams) === null || _a === void 0 ? void 0 : _a.session)) {
            throw new Error("Must have active AMS authentication");
        }
        const response = yield fetch(`https://api.ecogytest.io/events?start=${start}&end=${end}`, {
            headers: {
                Authorization: cfg.ams.session
            }
        });
        if (response.status != 200) {
            throw new Error(`Failed to fetch export data, code: ${response.status}, message: ${response.statusText}`);
        }
        const json = yield response.json();
        const events = json["events"];
        const properties = [
            "path",
            "assetType",
            "dueDate",
            "userName",
            "priority",
            "updated",
            "userId",
            "startDate",
            "description",
            "id",
            "cause",
            "type"
        ];
        for (let i = 0; i < properties.length; i++) {
            process.stdout.write(properties[i]);
            process.stdout.write(i == (properties.length - 1) ? '\n' : ',');
        }
        for (const event of events) {
            for (let i = 0; i < properties.length; i++) {
                const p = properties[i];
                if (event[p]) {
                    let str = event[p].toString();
                    str = str.replace(/\n/g, "\\n");
                    str = str.replace(/\r/g, "\\r");
                    str = str.replace(/,/g, "\\,");
                    process.stdout.write(str);
                }
                process.stdout.write(i == (properties.length - 1) ? '\n' : ',');
            }
        }
    });
}
