var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { URL, URLSearchParams } from "url";
import axios from "axios";
import { AuthorizationV2Builder, DatumStreamMetadataRegistry } from "solarnetwork-api-core";
import { readConfigFile } from "./config.js";
function encodeSolarNetworkUrl(url) {
    return url.toString().replace(/\+/g, "%20"); // SolarNetwork doesn't support + for space character encoding
}
function getNodeIds(auth, secret) {
    return __awaiter(this, void 0, void 0, function* () {
        const url = "https://data.solarnetwork.net/solaruser/api/v1/sec/nodes";
        const authHeader = auth.snDate(true).url(url).build(secret);
        const response = yield axios.get(url, {
            headers: {
                Authorization: authHeader,
                "X-SN-Date": auth.requestDateHeaderValue
            }
        });
        return response.data.data.results.map((x) => x.id);
    });
}
function getDatums(source, auth, secret, ids, start, end, aggregation) {
    return __awaiter(this, void 0, void 0, function* () {
        let raw = {
            //startDate: "2020-01-01",
            startDate: start,
            //endDate: "2022-01-02",
            endDate: end,
            nodeIds: ids,
            sourceId: source
        };
        if (aggregation)
            raw.aggregation = aggregation;
        const params = new URLSearchParams(raw);
        const url = "https://data.solarnetwork.net/solarquery/api/v1/sec/datum/stream/datum";
        const fetchUrl = new URL(url);
        fetchUrl.search = params.toString();
        const urlString = encodeSolarNetworkUrl(fetchUrl);
        const authHeader = auth.snDate(true).url(urlString).build(secret);
        const response = yield axios.get(urlString, {
            headers: {
                Authorization: authHeader,
                "X-SN-Date": auth.requestDateHeaderValue
            }
        });
        return response.data;
    });
}
function columnName(c) {
    const meta = c.indexOf("$");
    return meta == -1 ? c : c.substring(0, meta);
}
function columnValue(c, row, m) {
    const meta = c.indexOf("$");
    const name = columnName(c);
    const indx = m['i'].findIndex((v) => v == name);
    if (meta != -1) {
        const metaValue = c.substring(meta + 1);
        if (metaValue == "average") {
            return row[2 + indx][0];
        }
        else if (metaValue == "count") {
            return row[2 + indx][1];
        }
        else if (metaValue == "minimum") {
            return row[2 + indx][2];
        }
        else if (metaValue == "maximum") {
            return row[2 + indx][3];
        }
        else {
            throw new Error("unknown meta description");
        }
    }
    else {
        // return average
        return row[2 + indx][0];
    }
}
export function fetchSNDatums(source, format, start, end, opts) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        const cfg = readConfigFile();
        if (!((_a = cfg.sn) === null || _a === void 0 ? void 0 : _a.token)) {
            throw new Error("You must provide a token");
        }
        if (!((_b = cfg.sn) === null || _b === void 0 ? void 0 : _b.secret)) {
            throw new Error("You must provide a secret");
        }
        const auth = new AuthorizationV2Builder(cfg.sn.token);
        const ids = yield getNodeIds(auth, cfg.sn.secret);
        const datums = yield getDatums(source, auth, cfg.sn.secret, ids, start, end, opts['aggregation']);
        const d = new DatumStreamMetadataRegistry(datums.meta);
        const columns = format.split(",");
        console.log("sourceId,objectId," + format);
        for (const row of datums.data) {
            const m = d.metadataAt(row[0]);
            const foundColumns = columns.filter(c => {
                if (c == "timestamp")
                    return true;
                return m['i'].findIndex((v) => v == columnName(c)) >= 0;
            });
            if (foundColumns.length != columns.length) {
                const empty = opts['empty'];
                const partial = opts['partial'];
                const isEmpty = foundColumns.length == 1;
                const isPartial = foundColumns.length > 1;
                if (isEmpty && !empty) {
                    continue;
                }
                if (isPartial && !partial && !empty) {
                    continue;
                }
            }
            process.stdout.write(m['sourceId'].toString());
            process.stdout.write(',');
            process.stdout.write(m['objectId'].toString());
            process.stdout.write(',');
            for (let i = 0; i < columns.length; i++) {
                const c = columns[i];
                const sep = (i < (columns.length - 1)) ? ',' : '';
                if (c == "timestamp") {
                    // TODO: ignoring end?
                    process.stdout.write(row[1][0].toString());
                    process.stdout.write(sep);
                    continue;
                }
                const indx = m['i'].findIndex((v) => v == c);
                process.stdout.write(columnValue(c, row, m).toString());
                process.stdout.write(sep);
            }
            process.stdout.write("\n");
        }
    });
}
