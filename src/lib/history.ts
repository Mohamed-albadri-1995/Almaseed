import { prisma } from './prisma';

// Save the current state of a material as a version snapshot before it changes.
export async function snapshotMaterial(
  materialId: string,
  editorId: string | null,
  editorName: string | null,
  reason: string,
) {
  const current = await prisma.material.findUnique({ where: { id: materialId } });
  if (!current) return;
  const { searchText, ...fields } = current;
  await prisma.materialVersion.create({
    data: {
      materialId,
      editorId,
      editorName,
      reason,
      snapshot: JSON.stringify(fields),
    },
  });
}
