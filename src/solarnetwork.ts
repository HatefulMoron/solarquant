import {URL, URLSearchParams} from "url";
import axios from "axios";
import {AuthorizationV2Builder, DatumStreamMetadataRegistry } from "solarnetwork-api-core";
import {readConfigFile} from "./config.js";

function encodeSolarNetworkUrl(url: any) {
    return url.toString().replace(/\+/g, "%20") // SolarNetwork doesn't support + for space character encoding
}

async function getNodeIds(auth: any, secret: string) {
    const url = "https://data.solarnetwork.net/solaruser/api/v1/sec/nodes"
    const authHeader = auth.snDate(true).url(url).build(secret)

    const response = await axios.get(url, {
        headers: {
            Authorization: authHeader,
            "X-SN-Date": auth.requestDateHeaderValue
        }
    })

    return response.data.data.results.map((x: any) => x.id)
}

async function getDatums(source:string, auth: any, secret: string, ids: any, start: string, end: string, aggregation?: string) {

    let raw: any = {
        //startDate: "2020-01-01",
        startDate: start,
        //endDate: "2022-01-02",
        endDate: end,
        nodeIds: ids,
        sourceId: source
    }

    if (aggregation)
        raw.aggregation = aggregation

    const params = new URLSearchParams(raw)
    const url = "https://data.solarnetwork.net/solarquery/api/v1/sec/datum/stream/datum"

    const fetchUrl = new URL(url)
    fetchUrl.search = params.toString()
    const urlString = encodeSolarNetworkUrl(fetchUrl)

    const authHeader = auth.snDate(true).url(urlString).build(secret)

    const response = await axios.get(urlString, {
        headers: {
            Authorization: authHeader,
            "X-SN-Date": auth.requestDateHeaderValue
        }
    })

    return response.data
}

function columnName(c: string): string {
    const meta = c.indexOf("$")
    return meta == -1 ? c : c.substring(0, meta)
}

function columnValue(c: string, row: any, m: any): string {
    const meta = c.indexOf("$")
    const name = columnName(c)
    const indx = m['i'].findIndex((v: any) => v == name)

    if (meta != -1) {
        const metaValue = c.substring(meta+1)

        if (metaValue == "average") {
            return row[2 + indx][0]
        } else if (metaValue == "count") {
            return row[2 + indx][1]
        } else if (metaValue == "minimum") {
            return row[2 + indx][2]
        } else if (metaValue == "maximum") {
            return row[2 + indx][3]
        } else {
            throw new Error("unknown meta description")
        }
    } else {
        // return average
        return row[2 + indx][0]
    }
}

export async function fetchSNDatums(source: string, format: string, start: string, end: string, opts: any): Promise<void> {
    const cfg = readConfigFile()

    if (!cfg.sn?.token) {
        throw new Error("You must provide a token")
    }

    if (!cfg.sn?.secret) {
        throw new Error("You must provide a secret")
    }

    const auth = new AuthorizationV2Builder(cfg.sn.token)

    const ids = await getNodeIds(auth, cfg.sn.secret)

    const datums = await getDatums(source, auth, cfg.sn.secret, ids, start, end, opts['aggregation'])
    const d = new DatumStreamMetadataRegistry(datums.meta)

    const columns = format.split(",")

    console.log("sourceId,objectId," + format)

    for (const row of datums.data) {
        const m = d.metadataAt(row[0])

        const foundColumns = columns.filter(c => {
            if (c == "timestamp")
                return true

            return m['i'].findIndex((v: any) => v == columnName(c)) >= 0
        })

        if (foundColumns.length != columns.length) {
            const empty = opts['empty']
            const partial = opts['partial']
            const isEmpty = foundColumns.length == 1
            const isPartial = foundColumns.length > 1

            if (isEmpty && !empty) {
                continue
            }
            if (isPartial && !partial && !empty) {
                continue
            }
        }

        process.stdout.write(m['sourceId'].toString())
        process.stdout.write(',')
        process.stdout.write(m['objectId'].toString())
        process.stdout.write(',')

        for (let i=0; i<columns.length; i++) {
            const c = columns[i]
            const sep = (i < (columns.length-1)) ? ',' : ''

            if (c == "timestamp") {
                // TODO: ignoring end?
                process.stdout.write(row[1][0].toString())
                process.stdout.write(sep)
                continue
            }

            const indx = m['i'].findIndex((v: any) => v == c)

            process.stdout.write(columnValue(c, row, m).toString())
            process.stdout.write(sep)
        }

        process.stdout.write("\n")
    }

}
