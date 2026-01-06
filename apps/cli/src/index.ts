#!/usr/bin/env node

import { Command } from "commander";
import { login, register } from "./commands/auth.js";
import chalk from "chalk";
import { init } from "./commands/init.js";
import { link } from "./commands/link";
import { status } from "./commands/status.js";

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

program
  .command("status")
  .description("Get the status of your Shiplio project")
  .action(status);

program.name("shiplio").description("Shiplio PaaS CLI").version("0.0.1");

program.command("login").description("Login to Shiplio account").action(login);

program
  .command("register")
  .description("Register to Shiplio account")
  .action(register);

program
  .command("ping")
  .description("Simple ping test")
  .action(() => {
    console.log(chalk.green("pong"));
  });

program.parse(process.argv);
