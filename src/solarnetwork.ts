import {URL, URLSearchParams} from "url";
import axios from "axios";
import {AuthorizationV2Builder, DatumStreamMetadataRegistry} from "solarnetwork-api-core";
import {readConfigFile, S3Config} from "./config.js";
import {getAMSProjects} from "./ams.js"
import cliProgress, {MultiBar} from "cli-progress"
import {SimpleChannel, TryReceivedKind} from "channel-ts";
import {getDateRanges} from "./util.js";
import moment  from "moment";

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

async function getDatums(mostRecent: boolean, source: string, auth: any, secret: string, ids: any, start?: string, end?: string, aggregation?: string) {

    let raw: any = {
        nodeIds: ids,
        sourceId: source,
        mostRecent: mostRecent
    }

    if (end)
        raw.endDate = end

    if (start)
        raw.startDate = start

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

async function listSources(source: string, auth: any, secret: string, ids: any): Promise<string[]> {
    const result = await getDatums(true, source, auth, secret, ids, undefined, undefined)
    return result.meta.map((m: any) => m['sourceId'])
}

async function exportDatums(cfg: S3Config, source: string, auth: any, secret: string, ids: any, start: string, end: string, aggregation?: string) {
    const service = "net.solarnetwork.central.datum.export.standard.CsvDatumExportOutputFormatService"
    const exportService = "net.solarnetwork.central.datum.export.dest.s3.S3DatumExportDestinationService"

    let datumFilter = {
        nodeIds: ids,
        sourceIds: source,
        startDate: start,
        endDate: end,
    }

    let body = {
        name: "test",
        dataConfiguration: {
            datumFilter: datumFilter,
        },
        outputConfiguration: {
            compressionTypeKey: "n", // g = gzip, x = XZ, n = none
            serviceIdentifier: service,
            serviceProperties: {
                includeHeader: true,
            },
        },
        destinationConfiguration: {
            serviceIdentifier: "net.solarnetwork.central.datum.export.dest.s3.S3DatumExportDestinationService",
            serviceProperties: {
                path: cfg.bucketPath,
                filenameTemplate: "test" + "-{date}.{ext}",
                accessKey: cfg.accessToken,
                secretKey: cfg.accessSecret,
            },
        },
    }

    let bodyString = JSON.stringify(body)
    let url = "https://data.solarnetwork.net/solaruser/api/v1/sec/user/export/adhoc"

    let authHeader = auth.snDate(true).method("POST").contentType("application/json; charset=UTF-8").url(url).computeContentDigest(bodyString).build(secret)

    return fetch(url, {
        method: "POST",
        headers: {
            Authorization: authHeader,
            "X-SN-Date": auth.requestDateHeaderValue,
            "Content-Type": "application/json; charset=UTF-8",
        },
        body: bodyString,
    }).then((response) => {
        if (response.ok) {
            console.log("request sent")
            console.log(response)
            return response.json()
        } else {
            console.error("failed")
            console.error(response)
            return Promise.reject(response.statusText)
        }
    })
}

function columnName(c: string): string {
    const meta = c.indexOf("$")
    return meta == -1 ? c : c.substring(0, meta)
}

function columnValue(aggregated: boolean, c: string, row: any, m: any): string {
    const meta = c.indexOf("$")
    const name = columnName(c)
    const indx = m['i'].findIndex((v: any) => v == name)

    if (!row[2 + indx]) {
        return ""
    }

    if (meta != -1) {
        const metaValue = c.substring(meta + 1)

        if (!aggregated && metaValue != "count") {
            return row[2 + indx]
        } else if (!aggregated && metaValue == "count") {
            return "1"
        }

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

export async function fetchSNDatumsS3(): Promise<void> {
    const cfg = readConfigFile()

    if (!cfg.s3?.bucketPath) {
        throw new Error("You must provide an S3 bucket")
    }

    if (!cfg.s3?.accessToken) {
        throw new Error("You must provide an access token for the S3 bucket")
    }

    if (!cfg.s3?.accessSecret) {
        throw new Error("You must provide an access secret for the S3 bucket")
    }
}

function chunkArray<T>(arr: T[], n: number): T[][] {
    var chunkLength = Math.max(arr.length/n ,1);
    var chunks = [];
    for (var i = 0; i < n; i++) {
        if(chunkLength*(i+1)<=arr.length)chunks.push(arr.slice(chunkLength*i, chunkLength*(i+1)));
    }
    return chunks;
}

interface SNChunk {
    datums: any,
    total: number
}

async function fetchSNDatumsProducer(chan: SimpleChannel<SNChunk>, bar: MultiBar, auth: any, secret: string, ids: any, sources: string[], format: string, start: string, end: string, opts: any) {
    if (!sources) {
        return
    }

    const ranges = getDateRanges(moment(start), moment(end))

    for (const source of sources) {
        const b = bar.create(ranges.length, 0, {}, {
            format: ' {bar} | {sourceId}',
        })
        try {
            let total = 0

            for (const range of ranges) {
                const s = range.beginInclusive.format("YYYY-MM-DD")
                const e = range.endExclusive.format("YYYY-MM-DD")

                total += 1

                b.update(total, {sourceId: source})

                const datums = await getDatums(false, source, auth, secret, ids, s, e, opts['aggregation'])
                chan.send({
                    datums: datums,
                    total: total
                })
            }
        } catch(e: any) {
            console.error(e)
            console.log("ERROR: " + e.config.url)
        }
        bar.remove(b)
    }
}

async function fetchSNDatumsConsumer(chan: SimpleChannel<SNChunk>, bar: MultiBar, total: number, auth: any, secret: string, ids: any, format: string, start: string, end: string, opts: any) {

    const columns = format.split(",")
    const b = bar.create(total, 0,{}, {
        format: ' {bar} | Total Progress: {value}/{total} | {eta_formatted}',
    })

    for await(const next of chan) {
        const datums = next.datums

        b.increment()

        if (!datums.data || !datums.meta) {
            continue
        }

        const d = new DatumStreamMetadataRegistry(datums.meta)

        for (const row of datums.data) {
            if (!row) {
                continue
            }

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

            if (m['sourceId']) {
                process.stdout.write(m['sourceId'].toString())
            }
            process.stdout.write(',')

            if (m['objectId']) {
                process.stdout.write(m['objectId'].toString())
            }
            process.stdout.write(',')

            for (let i = 0; i < columns.length; i++) {
                const c = columns[i]
                const sep = (i < (columns.length - 1)) ? ',' : ''

                if (c == "timestamp") {
                    // TODO: ignoring end?
                    if (opts['aggregations'] != undefined) {
                        if (row[1][0]) {
                            process.stdout.write(row[1][0].toString())
                        }
                    } else {
                        if (row[1]) {
                            process.stdout.write(row[1].toString())
                        }
                    }
                    //process.stdout.write(sep)
                    continue
                }

                const val = columnValue(opts['aggregation'] != undefined, c, row, m)

                if (val) {
                    process.stdout.write(val.toString())
                }
                process.stdout.write(sep)
            }

            process.stdout.write("\n")
        }
    }

}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchSNDatums(source: string, format: string, start: string, end: string, opts: any): Promise<void> {
    const cfg = readConfigFile()

    if (!cfg.sn) {
        throw new Error("You must authenticate against SolarNetwork")
    }

    if (!cfg.sn.token) {
        throw new Error("You must provide a token")
    }

    if (!cfg.sn.secret) {
        throw new Error("You must provide a secret")
    }

    const auth = new AuthorizationV2Builder(cfg.sn.token)

    const ids = await getNodeIds(auth, cfg.sn.secret)
    const sources = await listSources(source, auth, cfg.sn.secret, ids)
    const coefficient = getDateRanges(moment(start), moment(end)).length

    const bar = new cliProgress.MultiBar({
        etaBuffer: 64,
        clearOnComplete: true,
        hideCursor: true,
        format: ' {bar} | {filename} | {value}/{total}',
        forceRedraw: true,
    }, cliProgress.Presets.rect)

    console.log("sourceId,objectId," + format)

    const secret: string = cfg.sn.secret
    const parallel: number = parseInt(opts['parallel'])

    const chan = new SimpleChannel<SNChunk>();
    const groups = chunkArray(sources, parallel)
    const p1 = fetchSNDatumsConsumer(chan, bar, sources.length * coefficient, auth, secret, ids, format, start, end, opts)
    const p2 = Array.from(Array(parallel).keys()).map(async i => fetchSNDatumsProducer(chan, bar, auth, secret, ids, groups[i], format, start, end, opts))

    await Promise.all(p2)
    chan.close()
    await p1

    bar.stop()
}
