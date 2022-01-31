import { parse } from "marked";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { red, green } from "btss";
import express from "express";
import { Server } from "socket.io";
import { createServer } from "http";
import { watch } from "chokidar";

const error = (s) => {
  throw red("[ERROR] ") + s;
};
const log = (s) => console.log(s);

try {
  init(parseArgs(process.argv.splice(2)));
} catch (e) {
  console.error(e);
  process.exit(e);
}

function init({ words, options }) {
  const path = resolve(process.cwd(), words[0]);
  if (!existsSync(path)) error(`no such file ${path}`);

  const port = 8000;
  const app = express();
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
  server.listen(port, () => log(`listening on ${port}`));

  watch(path, {
    persistent: true,
  }).on("change", (path) => {
    log(green("change dectected."));
    socket.emit("reload");
  });
}

function compile(path) {
  return parse(readFileSync(path, "utf-8"));
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
