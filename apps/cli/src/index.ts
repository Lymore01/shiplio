#!/usr/bin/env node

import { Command } from "commander";
import { loginViaWeb } from "./commands/auth.js";
import chalk from "chalk";
import { init } from "./commands/init.js";
import { link } from "./commands/link.js";
import { status } from "./commands/status.js";
import { whoami } from "./commands/whoami.js";
import { deploy } from "./commands/deploy.js";
import { logs } from "./commands/logs.js";
import { destroy } from "./commands/destroy.js";
import { setEnv } from "./commands/setEnv.js";
import { listEnv } from "./commands/listEnv.js";
import { unsetEnv } from "./commands/unsetEnv.js";

const program = new Command();

program
  .command("init [projectName]")
  .configureOutput({
    outputError: (str, write) => write(str.replace(/^error:\s*/, "")),
  })
  .description("Initialize a new project")
  .action(init);

program
  .command("link")
  .description("Link this directory to an existing Shiplio project")
  .action(link);

program.command("whoami").description("Who am I?").action(whoami);

program
  .command("status")
  .description("Get the status of your Shiplio project")
  .action(status);

program.command;

program.command("deploy").description("Deploy your project").action(deploy);

const env = program
  .command("env")
  .description("Manage project environment variables");

env
  .command("set [vars...]")
  .description("Set environment variables (KEY=VALUE)")
  .action((vars) => {
    return setEnv(vars);
  });

env
  .command("list")
  .description("List all environment variables")
  .action(listEnv);

env
  .command("unset [keys...]")
  .description("Unset environment variables by keys")
  .action((keys) => {
    return unsetEnv(keys);
  });

program.name("shiplio").description("Shiplio PaaS CLI").version("0.0.1");

program.command("destroy").description("Destroy your project").action(destroy);

program
  .command("logs")
  .description("Stream real-time runtime logs from your deployed container")
  .option(
    "-t, --tail <number>",
    "Number of lines to show from the end of the logs",
    "50",
  )
  .action(async (options) => {
    await logs(options);
  });

program
  .command("login")
  .description("Login to Shiplio account")
  .action(loginViaWeb);

program
  .command("ping")
  .description("Simple ping test")
  .action(() => {
    console.log(chalk.green("pong"));
  });

program.parse(process.argv);
