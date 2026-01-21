#!/usr/bin/env node

import { Command } from "commander";
import { loginViaWeb, register } from "./commands/auth.js";
import chalk from "chalk";
import { init } from "./commands/init.js";
import { link } from "./commands/link.js";
import { status } from "./commands/status.js";
import { whoami } from "./commands/whoami.js";
import { pushEnv } from "./commands/env.js";
import { deploy } from "./commands/deploy.js";
import { logs } from "./commands/logs.js";

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

program.command("env:push").description("Push .env to Shiplio").action(pushEnv);

program.command("deploy").description("Deploy your project").action(deploy);

program.name("shiplio").description("Shiplio PaaS CLI").version("0.0.1");

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

// program.command("login").description("Login to Shiplio account").action(login);
program
  .command("login")
  .description("Login to Shiplio account")
  .action(loginViaWeb);

// program
//   .command("register")
//   .description("Register to Shiplio account")
//   .action(register);

program
  .command("ping")
  .description("Simple ping test")
  .action(() => {
    console.log(chalk.green("pong"));
  });

program.parse(process.argv);
