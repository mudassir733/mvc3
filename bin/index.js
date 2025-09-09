#!/usr/bin/env node
import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import fs from "fs-extra";
import path from "path";
import { execa } from "execa";

const program = new Command();

program
  .name("create-mvc-app")
  .description("CLI to generate MVC/3-layer Node.js starter projects")
  .argument("<projectName>", "Name of the project")
  .action(async (projectName) => {
    console.log(chalk.cyan(`\n Creating new project: ${projectName}\n`));

    const answers = await inquirer.prompt([
      {
        type: "list",
        name: "language",
        message: "Which language do you want?",
        choices: ["JavaScript", "TypeScript"]
      },
      {
        type: "list",
        name: "architecture",
        message: "Which architecture do you want?",
        choices: ["Simple MVC", "3-Layer MVC"]
      },
      {
        type: "confirm",
        name: "nodemon",
        message: "Use Nodemon for dev?",
        default: true
      },
      {
        type: "confirm",
        name: "git",
        message: "Initialize Git repository?",
        default: true
      },
      {
        type: "confirm",
        name: "installDeps",
        message: "Install dependencies now?",
        default: true
      }
    ]);

    const projectPath = path.join(process.cwd(), projectName);
    const spinner = ora("Scaffolding project...").start();

    try {
      await fs.ensureDir(projectPath);

      // basics
      await fs.writeFile(
        path.join(projectPath, ".gitignore"),
        "node_modules\ndist\n.env\n"
      );
      await fs.writeFile(path.join(projectPath, ".env"), "PORT=5000\n");

      // folders
      const srcDir = path.join(projectPath, "src");
      await fs.ensureDir(srcDir);

      const baseFolders =
        answers.architecture === "3-Layer MVC"
          ? ["controllers", "services", "models", "routes", "config", "validation", "utils", "templates"]
          : ["controllers", "models", "routes", "views"];

      for (const folder of baseFolders) {
        await fs.ensureDir(path.join(srcDir, folder));
      }

      // app files
      const isTS = answers.language === "TypeScript";
      const appExt = isTS ? "ts" : "js";
      const appContent = `
import express from "express";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

// routes
app.get("/", (_req, res) => {
  res.send("Hello World!");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});
      `.trim();

      await fs.writeFile(path.join(srcDir, `app.${appExt}`), appContent);

      // basic route file
      const routeContent = `
import { Router } from "express";
const router = Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true });
});

export default router;
      `.trim();

      await fs.writeFile(path.join(srcDir, "routes", `index.${appExt}`), routeContent);

      // package.json
      const pkgJson = isTS
        ? {
            name: projectName,
            version: "1.0.0",
            description: "",
            main: "dist/app.js",
            // no "type": "module" -> keep CommonJS at runtime
            scripts: {
              dev: answers.nodemon ? "nodemon" : "node -r ts-node/register/transpile-only src/app.ts",
              build: "tsc",
              start: "node dist/app.js"
            }
          }
        : {
            name: projectName,
            version: "1.0.0",
            description: "",
            main: "src/app.js",
            scripts: {
              dev: answers.nodemon ? "nodemon" : "node src/app.js",
              start: "node src/app.js"
            },
            type: "module" // JS uses ESM nicely
          };

      await fs.writeJson(path.join(projectPath, "package.json"), pkgJson, { spaces: 2 });

      // nodemon.json
      if (answers.nodemon) {
        const nodemonJson = isTS
          ? {
              watch: ["src"],
              ext: "ts,js,json",
              ignore: ["dist"],
              exec: "node -r ts-node/register/transpile-only src/app.ts"
            }
          : {
              watch: ["src"],
              ext: "js,json",
              ignore: ["dist"],
              exec: "node src/app.js"
            };
        await fs.writeJson(path.join(projectPath, "nodemon.json"), nodemonJson, { spaces: 2 });
      }

      // tsconfig for TS
      if (isTS) {
        const tsConfig = {
          compilerOptions: {
            target: "ES2020",
            module: "CommonJS",
            moduleResolution: "node",
            rootDir: "src",
            outDir: "dist",
            resolveJsonModule: true,
            esModuleInterop: true,
            forceConsistentCasingInFileNames: true,
            strict: true,
            skipLibCheck: true,
            baseUrl: "src",
            paths: { "*": ["*"] }
          },
          include: ["src/**/*.ts"],
          exclude: ["node_modules", "dist"]
        };
        await fs.writeJson(path.join(projectPath, "tsconfig.json"), tsConfig, { spaces: 2 });
      }

      // README quick hint
      const readme = `
# ${projectName}

## Dev
${isTS ? "- \`npm run dev\` runs nodemon with ts-node.\n" : "- \`npm run dev\` runs nodemon."}

## Build
${isTS ? "- \`npm run build\` compiles to \`dist/\`.\n- \`npm start\` runs compiled JS.\n" : ""}

      `.trim();
      await fs.writeFile(path.join(projectPath, "README.md"), readme + "\n");

      // git
      if (answers.git) {
        await execa("git", ["init"], { cwd: projectPath });
        console.log(chalk.blue("Git repository initialized"));
      }

      // install deps
      if (answers.installDeps) {
        console.log(chalk.cyan("\n Installing dependencies..."));

        const deps = ["express", "dotenv", "bcrypt", "cors", "morgan"];
        const devDeps = [];

        if (isTS) {
          devDeps.push("typescript", "ts-node", "nodemon", "@types/node", "@types/express");
        } else if (answers.nodemon) {
          devDeps.push("nodemon");
        }

        await execa("npm", ["install", ...deps], {
          cwd: projectPath,
          stdio: "inherit"
        });

        if (devDeps.length) {
          await execa("npm", ["install", "-D", ...devDeps], {
            cwd: projectPath,
            stdio: "inherit"
          });
        }

        console.log(chalk.green("Dependencies installed successfully"));
      } else {
        console.log(chalk.yellow("Skipped dependency installation"));
      }

      spinner.succeed("All setup completed!");
      console.log(
        chalk.green(
          `\nNext steps:\n  cd ${projectName}\n  ${answers.installDeps ? "" : "npm install\n  "}npm run dev\n`
        )
      );
    } catch (err) {
      spinner.fail("Failed to scaffold project.");
      console.error(err);
      process.exitCode = 1;
    }
  });

program.parse(process.argv);
