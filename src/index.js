#!/usr/bin/env node
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Command } from "commander";
import { listAMSProjects, listAMSSites, listAMSSources, listEvents } from "./ams.js";
import { authenticateAMS, authenticateSolarNetwork } from "./config.js";
import { fetchSNDatums } from "./solarnetwork.js";
const quant = new Command("sqc");
const config = new Command("config");
const projects = new Command("projects");
const events = new Command("events");
const datums = new Command("datums");
config
    .command("authenticate <type>")
    .description("Authenticate against a portal of a given type. Supports 'ams' and 'solarnetwork'.")
    .action((type) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (type.toLowerCase() == "ams") {
            yield authenticateAMS();
        }
        else if (type.toLowerCase() == "sn") {
            yield authenticateSolarNetwork();
        }
    }
    catch (e) {
        console.error(e);
    }
}));
projects
    .command("list")
    .description("List project codes")
    .option("-c, --codes", "Only print project codes", false)
    .action((opts) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield listAMSProjects(opts["codes"]);
    }
    catch (e) {
        console.error(e);
    }
}));
projects
    .command("list-sites <project>")
    .description("List site codes for a project")
    .action((project) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield listAMSSites(project);
    }
    catch (e) {
        console.error(e);
    }
}));
projects
    .command("list-sources <project> <site>")
    .description("List sources for site")
    .action((project, site) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield listAMSSources(project, site);
    }
    catch (e) {
        console.error(e);
    }
}));
events
    .command("list <start> <end>")
    .description("List events")
    .action((start, end, project) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield listEvents(start, end);
    }
    catch (e) {
        console.error(e);
    }
}));
datums
    .option("-a, --aggregation <aggregation>", "Aggregation for datums")
    .option("-p, --partial", "Allow partial row matches")
    .option("-e, --empty", "Allow empty row matches")
    .command("stream <source> <format> <start> <end>")
    .action((source, format, start, end) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const opts = datums.opts();
        yield fetchSNDatums(source, format, start, end, opts);
    }
    catch (e) {
        console.error(e);
    }
}));
quant
    .addCommand(config)
    .addCommand(projects)
    .addCommand(events)
    .addCommand(datums);
quant.parse(process.argv);
