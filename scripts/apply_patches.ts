import { ensureDir, exists } from "https://deno.land/std/fs/mod.ts";

const VERSION = /(\d+)(\.(\d+)(\.(\d+))?)?$/;
const exec = (...cmd: string[]) => Deno.run({ cmd, stdout: "null" }).status();
const woExt = (s: string) => s.split(".").slice(0, -1).join(".").trim();
const woVer = (s: string) => s.replace(s.match(VERSION)?.at(0)!, "").trim();

const stdout = (t: string) => Deno.stdout.write(new TextEncoder().encode(t));

async function ensure(p: Promise<Deno.ProcessStatus>) {
  if (!(await p).success) throw new Error("Command was not successful");
}

async function applyPatches(dir: string, ext = "jar") {
  Deno.chdir(dir);

  // Set up arrays of zips and patches
  const zips: string[] = [];
  const patches: string[] = [];

  // List all the files in the datapacks directory.
  for await (const file of Deno.readDir(dir)) {
    if (file.name.endsWith(`.${ext}`)) zips.push(woExt(file.name));
    else if (file.name.endsWith(".patch")) patches.push(woExt(file.name));
  }

  // Filter the zips to be only the ones that have associated patches
  const zipsWithPatches = zips.filter((z) => patches.includes(woVer(z)));

  // Ensure backup folder is created
  const backups = `${wd}/scripts/backups`;
  await ensureDir(backups);

  for (const zip of zipsWithPatches) {
    const name = woVer(zip);
    await stdout(`\n=> Patching ${zip}.${ext}...\n`);

    // Back it up first
    await stdout(`Backing up original file... `);
    if (await exists(`${backups}/${zip}.${ext}`)) {
      await stdout("already backed up.\n");
    } else {
      await Deno.copyFile(`${zip}.${ext}`, `${backups}/${zip}.${ext}`);
      await stdout("done.\n");
    }

    // Unzip the file
    await stdout("Unzipping... ");
    await exec("unzip", `${zip}.${ext}`, "-d", name);
    await Deno.remove(`${zip}.${ext}`);
    Deno.chdir(name);
    await stdout("done.\n");

    // Apply the patch
    await stdout("Applying patch... ");
    await exec("patch", "-p1", "-i", `../${name}.patch`);
    await stdout("done.\n");

    // Zip it back up
    await stdout("Zipping back up... ");
    await exec("zip", "-Dr", `../${zip}.${ext}`, ".");
    Deno.chdir("..");
    await stdout("done.\n");

    await Deno.remove(name, { recursive: true });
    console.log(`Successfully patched ${zip}.${ext}!`);
  }

  console.log(
    `\n=== Successfully patched ${zipsWithPatches.length} ${ext}s! ===`,
  );
}

// Get the working directory by stripping the last 2 components from the path.
const wd = new URL(import.meta.url).pathname.split("/").slice(0, -2).join("/");
console.log(`Base directory is: ${wd}`);
Deno.chdir(wd);

await applyPatches(`${wd}/mods`);
await applyPatches(`${wd}/world/datapacks`, "zip");
