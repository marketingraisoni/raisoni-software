import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { SemiPolishPacketPlan } from '../src/models/SemiPolishPacketPlan.js';
import { SemiPolishPacketReturn } from '../src/models/SemiPolishPacketReturn.js';
import { SemiPolishPlanningImport } from '../src/models/SemiPolishPlanningImport.js';
import { SemiPolishProcess } from '../src/models/SemiPolishProcess.js';

const confirmed = process.argv.includes('--yes');
const planningFilesRoot = path.resolve(config.dataDir, 'planning-files');

function assertSafePlanningFilesPath() {
  const dataDir = path.resolve(config.dataDir);
  const relativePath = path.relative(dataDir, planningFilesRoot);
  if (
    !relativePath ||
    relativePath.startsWith('..') ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Unsafe planning files path: ${planningFilesRoot}`);
  }
}

async function clearPlanningImports() {
  if (!confirmed) {
    throw new Error(
      'Deletion was not confirmed. Run this command again with --yes.',
    );
  }

  await connectDB();

  const returnCount = await SemiPolishPacketReturn.countDocuments({
    planningImport: { $ne: null },
  });
  if (returnCount > 0) {
    throw new Error(
      `Refusing to clear imports because ${returnCount} packet return record(s) depend on them.`,
    );
  }

  const [importCount, packetPlanCount] = await Promise.all([
    SemiPolishPlanningImport.countDocuments(),
    SemiPolishPacketPlan.countDocuments(),
  ]);

  const processResult = await SemiPolishProcess.updateMany(
    {},
    {
      $set: {
        activePlanningImport: null,
        planningImportedAt: null,
        plannedPacketCount: 0,
        plannedPolishedPieces: 0,
        planningRoughCarat: null,
        plannedPolishedCarat: null,
        plannedYieldPercentage: null,
      },
    },
  );

  await SemiPolishPacketPlan.deleteMany({});
  await SemiPolishPlanningImport.deleteMany({});

  assertSafePlanningFilesPath();
  await fs.rm(planningFilesRoot, { recursive: true, force: true });

  console.log(
    JSON.stringify(
      {
        environment: config.env,
        removedPlanningImports: importCount,
        removedPacketPlans: packetPlanCount,
        resetProcesses: processResult.modifiedCount,
        removedFilesFrom: planningFilesRoot,
      },
      null,
      2,
    ),
  );
}

clearPlanningImports()
  .then(async () => {
    await disconnectDB();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(`Unable to clear planning imports: ${error.message}`);
    await disconnectDB();
    process.exit(1);
  });
