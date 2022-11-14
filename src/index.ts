#!/usr/bin/env -S NODE_OPTIONS=--no-warnings node
import axios from 'axios';

process.env.NODE_NO_WARNINGS = "1";

import {Command} from "commander";
import {listAMSProjects, listAMSSites, listAMSSources, listEvents} from "./ams.js"
import {authenticateAMS, authenticateSolarNetwork} from "./config.js";
import {fetchSNDatums} from "./solarnetwork.js";

const quant = new Command("sqc")
const config = new Command("config")
const projects = new Command("projects")
const events = new Command("events")
const datums = new Command("datums")

config
    .command("authenticate <type>")
    .description("Authenticate against a portal of a given type. Supports 'ams' and 'solarnetwork'.")
    .action(async (type: string) => {
        try {
            if (type.toLowerCase() == "ams") {
                await authenticateAMS()
            } else if (type.toLowerCase() == "sn") {
                await authenticateSolarNetwork()
            }
        } catch (e) {
            console.error(e)
        }
    })

projects
    .command("list")
    .description("List project codes")
    .option("-c, --codes", "Only print project codes", false)
    .action(async (opts) => {
        try {
            await listAMSProjects(opts["codes"])
        } catch (e) {
            console.error(e)
        }
    })

projects
    .command("list-sites <project>")
    .description("List site codes for a project")
    .action(async (project: string) => {
        try {
            await listAMSSites(project)
        } catch (e) {
            console.error(e)
        }
    })

projects
    .command("list-sources <project> <site>")
    .description("List sources for site")
    .action(async (project: string, site: string) => {
        try {
            await listAMSSources(project, site)
        } catch (e) {
            console.error(e)
        }
    })

events
    .command("list <start> <end>")
    .description("List events")
    .action(async (start: string, end: string, project: string) => {
        try {
            await listEvents(start, end)
        } catch (e) {
            console.error(e)
        }
    })

datums
    .option("-a, --aggregation <aggregation>", "Aggregation for datums")
    .option("-p, --partial", "Allow partial row matches")
    .option("-e, --empty", "Allow empty row matches")
    .command("stream <source> <format> <start> <end>")
    .action(async (source: string, format: string, start: string, end: string) => {
        try {
            const opts = datums.opts()
            await fetchSNDatums(source, format, start, end, opts)
        } catch (e) {
            console.error(e)
        }
    })

quant
    .addCommand(config)
    .addCommand(projects)
    .addCommand(events)
    .addCommand(datums)

quant.parse(process.argv)
