#!/usr/bin/env node
import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import fs from "fs-extra";
import path from "path";

const program = new Command();

program
  .name("create-mvc-app")
  .description("CLI to generate MVC/3-layer Node.js starter projects")
  .argument("<project-name>", "Name of the project")
  .action(async (projectName) => {
    console.log(chalk.cyan(`\n Creating new project: ${projectName}\n`));


    const answers = await inquirer.prompt([
      {
        type: "list",
        name: "language",
        message: "Which language do you want?",
        choices: ["JavaScript", "TypeScript"],
      },
      {
        type: "list",
        name: "architecture",
        message: "Which architecture do you want?",
        choices: ["Simple MVC", "3-Layer MVC"],
      },
      {
        type: "confirm",
        name: "nodemon",
        message: "Do you want Nodemon?",
        default: true,
      },
      {
        type: "confirm",
        name: "git",
        message: "Initialize Git repository?",
        default: true,
      },
      {
        type: "confirm",
        name: "installDeps",
        message: "Install dependencies now?",
        default: true,
      },
    ]);


    const projectPath = path.join(process.cwd(), projectName);
    const spinner = ora("Scaffolding project...").start();

    try {
      await fs.ensureDir(projectPath);
      await fs.writeFile(
        path.join(projectPath, ".gitignore"),
        "node_modules\n.env\n"
      );

      await fs.writeFile(path.join(projectPath, ".env"), "PORT=5000\n");


      const ext = answers.language === "TypeScript" ? "ts" : "js";
      const appContent = `
import express from "express";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(\`Server running on port \${PORT}\`));
`;

      await fs.writeFile(path.join(projectPath, `app.${ext}`), appContent.trim());

      const folders =
        answers.architecture === "3-Layer MVC"
          ? ["controllers", "services", "models", "routes", "config", "validation", "utils", "templates"]
          : ["controllers", "models", "routes", "views"];

      for (const folder of folders) {
        await fs.ensureDir(path.join(projectPath, folder));
      }

      spinner.succeed("Project scaffolded successfully!");
      console.log(chalk.green(`\n Project created at ${projectPath}\n`));
    } catch (error) {
      spinner.fail("Failed to scaffold project.");
      console.error(error);
    }


  });

program.parse(process.argv);

