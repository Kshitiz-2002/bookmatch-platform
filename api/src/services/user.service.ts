import prisma from "../prisma/client";

export default {
  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, roles: true, createdAt: true, updatedAt: true }
    });
  },

  async update(id: string, updates: Partial<{ name: string }>) {
    return prisma.user.update({ where: { id }, data: updates });
  },

  async getRecommendations(userId: string, n = 20) {
    const rec = await prisma.recommendation.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" }
    });
    if (!rec) return [];
    const items = (rec.items as any) as Array<{ bookId: string; score: number; reason?: string }>;
    return items.slice(0, n);
  }
};
