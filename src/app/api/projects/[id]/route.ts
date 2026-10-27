import { prisma } from "@/lib/prisma";

/** Reads a saved project back. Expired projects are treated as gone, not served. */
export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return Response.json({ error: "Not a project id." }, { status: 400 });

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, name: true, files: true, createdAt: true, expiresAt: true },
    });
    if (!project) return Response.json({ error: "That project does not exist, or it has been pruned." }, { status: 404 });
    if (project.expiresAt.getTime() < Date.now()) {
      return Response.json({ error: "That project has expired." }, { status: 410 });
    }
    return Response.json(project, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Saved projects are unavailable: this deployment has no database configured." }, { status: 503 });
  }
}
