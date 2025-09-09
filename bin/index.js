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
        name: "starter",
        message: "Do you want to create a starter CRUD template?",
        default: true
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

      const isTS = answers.language === "TypeScript";
      const ext = isTS ? "ts" : "js";

      const baseFolders =
        answers.architecture === "3-Layer MVC"
          ? ["controllers", "services", "models", "routes", "config", "validation", "utils", "templates"]
          : ["controllers", "models", "routes", "views"];

      for (const folder of baseFolders) {
        await fs.ensureDir(path.join(srcDir, folder));
      }

      // app file
      const appContentTS = `
import express from "express";
import dotenv from "dotenv";
${answers.starter ? `import userRoutes from "./routes/user.routes";` : ""}

dotenv.config();
const app = express();
app.use(express.json());

${answers.starter ? `app.use("/api/users", userRoutes);` : `app.get("/", (_req, res) => { res.send("Hello World!"); });`}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});
      `.trim();

      const appContentJS = `
import express from "express";
import dotenv from "dotenv";
${answers.starter ? `import userRoutes from "./routes/user.routes.js";` : ""}

dotenv.config();
const app = express();
app.use(express.json());

${answers.starter ? `app.use("/api/users", userRoutes);` : `app.get("/", (_req, res) => { res.send("Hello World!"); });`}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});
      `.trim();

      await fs.writeFile(
        path.join(srcDir, `app.${ext}`),
        isTS ? appContentTS : appContentJS
      );

      // starter CRUD files
      if (answers.starter) {
        // service
        const serviceContentTS = `
type User = { id: string; name: string; email: string };

let users: User[] = [];

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export default {
  async list() {
    return users;
  },
  async getById(id: string) {
    return users.find(u => u.id === id) || null;
  },
  async create(data: { name: string; email: string }) {
    const user: User = { id: makeId(), ...data };
    users.push(user);
    return user;
  },
  async update(id: string, data: Partial<Omit<User, "id">>) {
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...data };
    return users[idx];
  },
  async remove(id: string) {
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return false;
    users.splice(idx, 1);
    return true;
  }
};
        `.trim();

        const serviceContentJS = `
let users = [];

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export default {
  async list() {
    return users;
  },
  async getById(id) {
    return users.find(u => u.id === id) || null;
  },
  async create(data) {
    const user = { id: makeId(), ...data };
    users.push(user);
    return user;
  },
  async update(id, data) {
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...data };
    return users[idx];
  },
  async remove(id) {
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return false;
    users.splice(idx, 1);
    return true;
  }
};
        `.trim();

        await fs.writeFile(
          path.join(srcDir, "services", `user.service.${ext}`),
          isTS ? serviceContentTS : serviceContentJS
        );

        // controller
        const controllerContentTS = `
import { Request, Response } from "express";
import userService from "../services/user.service";

export default {
  async list(req: Request, res: Response) {
    const data = await userService.list();
    res.json(data);
  },

  async getById(req: Request, res: Response) {
    const item = await userService.getById(req.params.id);
    if (!item) return res.status(404).json({ message: "User not found" });
    res.json(item);
  },

  async create(req: Request, res: Response) {
    const { name, email } = req.body;
    const item = await userService.create({ name, email });
    res.status(201).json(item);
  },

  async update(req: Request, res: Response) {
    const { name, email } = req.body;
    const item = await userService.update(req.params.id, { name, email });
    if (!item) return res.status(404).json({ message: "User not found" });
    res.json(item);
  },

  async remove(req: Request, res: Response) {
    const ok = await userService.remove(req.params.id);
    if (!ok) return res.status(404).json({ message: "User not found" });
    res.status(204).send();
  }
};
        `.trim();

        const controllerContentJS = `
import userService from "../services/user.service.js";

export default {
  async list(_req, res) {
    const data = await userService.list();
    res.json(data);
  },

  async getById(req, res) {
    const item = await userService.getById(req.params.id);
    if (!item) return res.status(404).json({ message: "User not found" });
    res.json(item);
  },

  async create(req, res) {
    const { name, email } = req.body;
    const item = await userService.create({ name, email });
    res.status(201).json(item);
  },

  async update(req, res) {
    const { name, email } = req.body;
    const item = await userService.update(req.params.id, { name, email });
    if (!item) return res.status(404).json({ message: "User not found" });
    res.json(item);
  },

  async remove(req, res) {
    const ok = await userService.remove(req.params.id);
    if (!ok) return res.status(404).json({ message: "User not found" });
    res.status(204).send();
  }
};
        `.trim();

        await fs.writeFile(
          path.join(srcDir, "controllers", `user.controller.${ext}`),
          isTS ? controllerContentTS : controllerContentJS
        );

        // routes
        const routesContentTS = `
import { Router } from "express";
import userController from "../controllers/user.controller";

const router = Router();

router.get("/", userController.list);
router.get("/:id", userController.getById);
router.post("/", userController.create);
router.put("/:id", userController.update);
router.delete("/:id", userController.remove);

export default router;
        `.trim();

        const routesContentJS = `
import { Router } from "express";
import userController from "../controllers/user.controller.js";

const router = Router();

router.get("/", userController.list);
router.get("/:id", userController.getById);
router.post("/", userController.create);
router.put("/:id", userController.update);
router.delete("/:id", userController.remove);

export default router;
        `.trim();

        await fs.writeFile(
          path.join(srcDir, "routes", `user.routes.${ext}`),
          isTS ? routesContentTS : routesContentJS
        );
      }

      // package.json
      const pkgJson = isTS
        ? {
            name: projectName,
            version: "1.0.0",
            description: "",
            main: "dist/app.js",
            scripts: {
              dev: answers.nodemon
                ? "nodemon"
                : "node -r ts-node/register/transpile-only src/app.ts",
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
            type: "module"
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

      // README
      const readme = `
# ${projectName}

## Endpoints (users)
- GET /api/users
- GET /api/users/:id
- POST /api/users
- PUT /api/users/:id
- DELETE /api/users/:id

## Dev
${isTS ? "- \`npm run dev\` runs nodemon with ts-node.\n" : "- \`npm run dev\` runs nodemon."}

## Build (TS)
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
