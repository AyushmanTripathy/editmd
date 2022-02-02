#!/usr/bin/env node

import { parse } from "marked";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { red, green, yellow } from "btss";
import express from "express";
import { spawn } from "child_process";
import { Server } from "socket.io";
import { createServer } from "http";
import { watch } from "chokidar";

const error = (s) => {
  throw red("[ERROR] ") + s;
};
const log = (s) => console.log(s);

try {
  await init(parseArgs(process.argv.splice(2)));
} catch (e) {
  console.error(e);
  process.exit(1);
}

async function init({ words, options }) {
  let port = 8080;
  let verbose = true;
  let launch_editor = false;
  let launch_browser = false;

  for (const option in options) {
    switch (option) {
      case "e":
        launch_editor = options[option];
        verbose = false;
        break;
      case "p":
        port = options[option];
        break;
      case "h":
        help();
        process.exit();
        break;
      case "b":
        launch_browser = true;
        break;
      default:
        error(`unknown option ${option}. use -h to know more.`);
        break;
    }
  }

  if (!words[0]) error("no path specified");
  const path = resolve(process.cwd(), words[0]);
  if (!existsSync(path)) error(`no such file ${path}`);

  const app = express();
  app.use("/", express.static(resolve(process.cwd())));

  const html = readFileSync(relativePath("assets/index.html"), "utf-8");

  app.get("/", function (req, res) {
    res.send(html.replace("%markdown%", compile(path)));
  });
  app.get("/style.css", (req, res) => {
    res.sendFile(relativePath("assets/style.css"));
  });
  app.get("/script.js", (req, res) => {
    res.sendFile(relativePath("assets/script.js"));
  });

  const server = createServer(app);
  const socket = new Server(server);
  server.listen(port, () => {
    if (verbose) log(`listening on ${port}`);
  });

  watch(path, {
    persistent: true,
  }).on("change", (path) => {
    if (verbose) log(green("change dectected."));
    socket.emit("reload");
  });
  if (launch_browser) openBrowser(`http://localhost:${port}`);
  if (launch_editor) {
    await openEditor(path, launch_editor);
    socket.emit("exit");
    process.exit();
  }
}

function compile(path) {
  return parse(readFileSync(path, "utf-8"));
}

function openBrowser(link) {
  let command = "xdg-open";
  switch (process.platform) {
    case "darwin":
      command = "open";
      break;
    case "win32":
      command = "start";
      break;
  }

  const child = spawn(command, [link], {
    stdio: "inherit",
    detached: true,
  });
  child.on("error", (err) => {
    log("error using " + command);
    log(err);
    process.exit(1);
  });
}

function openEditor(path, editor) {
  editor = editor === true ? process.env.EDITOR || "vim" : editor;
  log(yellow("Opening editor " + editor));

  const child = spawn(editor, [path], {
    stdio: "inherit",
    detached: true,
  });
  child.on("data", function (data) {
    process.stdout.pipe(data);
  });

  return new Promise((resolve, reject) => {
    child.on("exit", (e, code) => {
      log(yellow("Exiting..."));
      resolve();
    });
    child.on("error", (err) => {
      log("error while launching " + editor);
      log(err);
      resolve();
    });
  });
}

function parseArgs(args) {
  const options = {};
  const words = [];

  let temp;
  for (const arg of args) {
    if (arg.startsWith("-")) {
      temp = arg.substring(1);
      options[temp] = true;
    } else if (temp) {
      options[temp] = arg;
      temp = null;
    } else {
      words.push(arg);
    }
  }

  return { options, words };
}

function relativePath(path) {
  return new URL("../" + path, import.meta.url).pathname;
}

function help() {
  log(readFileSync(relativePath("help.txt"), "utf-8"));
}
