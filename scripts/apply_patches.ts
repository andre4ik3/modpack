import { ensureDir, exists } from "https://deno.land/std/fs/mod.ts";

const VERSION = /(\d+)(\.(\d+)(\.(\d+))?)?$/;
const exec = (...cmd: string[]) => Deno.run({ cmd, stdout: "null" }).status();
const woExt = (s: string) => s.split(".").slice(0, -1).join(".").trim();
const woVer = (s: string) => s.replace(s.match(VERSION)?.at(0)!, "").trim();

async function ensure(p: Promise<Deno.ProcessStatus>) {
  if (!(await p).success) throw new Error("Command was not successful");
}

// Get the working directory by stripping the last 2 components from the path.
const wd = new URL(import.meta.url).pathname.split("/").slice(0, -2).join("/");
console.log(`Base directory is: ${wd}`);
Deno.chdir(wd);

const datapacks = `${wd}/world/datapacks`;
Deno.chdir(datapacks);

// Set up arrays of zips and patches
const zips: string[] = [];
const patches: string[] = [];

// List all the files in the datapacks directory.
for await (const file of Deno.readDir(datapacks)) {
  if (file.name.endsWith(".zip")) zips.push(woExt(file.name));
  else if (file.name.endsWith(".patch")) patches.push(woExt(file.name));
}

// Filter the zips to be only the ones that have associated patches
const zipsWithPatches = zips.filter((z) => patches.includes(woVer(z)));

// Ensure backup folder is created
const backups = `${wd}/scripts/backups`;
await ensureDir(backups);

for (const zip of zipsWithPatches) {
  const name = woVer(zip);
  console.log(`\nPatching ${zip}.zip`);

  // Back it up first
  console.log(`Backing up original file...`);
  if (await exists(`${backups}/${zip}.zip`)) console.log("Already backed up.");
  else await Deno.copyFile(`${zip}.zip`, `${backups}/${zip}.zip`);

  // Unzip the file
  console.log(`Unzipping...`);
  await exec("unzip", `${zip}.zip`, "-d", name);
  await Deno.remove(`${zip}.zip`);
  Deno.chdir(name);

  // Apply the patch
  console.log(`Applying patch...`);
  await exec("patch", "-p1", "-i", `../${name}.patch`);

  // Zip it back up
  console.log(`Zipping back up...`);
  await exec("zip", "-Dr", `../${zip}.zip`, ".");
  Deno.chdir("..");

  await Deno.remove(name, { recursive: true });
  console.log(`Successfully patched ${zip}.zip!`);
}

console.log(`Successfully patched ${zipsWithPatches.length} datapacks!`);
