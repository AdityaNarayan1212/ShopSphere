import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const categories = [
    ["Electronics", "electronics"], ["Fashion", "fashion"],
    ["Home & Kitchen", "home-kitchen"], ["Books", "books"],
    ["Beauty & Personal Care", "beauty"], ["Sports & Fitness", "sports"]
  ];
  const catMap: Record<string, string> = {};
  for (const [name, slug] of categories) {
    const c = await prisma.category.upsert({ where: { slug }, update: {}, create: { name, slug } });
    catMap[name] = c.id;
  }
  const brandNames = ["NovaTech", "UrbanThread", "CasaLiving", "PageTurner", "GlowTheory", "ActivePulse"];
  const brandMap: Record<string, string> = {};
  for (const name of brandNames) {
    const b = await prisma.brand.upsert({ where: { name }, update: {}, create: { name } });
    brandMap[name] = b.id;
  }

  const products = [
    { name:"NovaTech Wireless Headphones", slug:"novatech-wireless-headphones", description:"Immersive sound, comfortable ear cushions and up to 30 hours of listening.", price:2499, originalPrice:3999, imageUrl:"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85", stock:24, category:"Electronics", brand:"NovaTech", rating:4.6, reviewCount:128 },
    { name:"Smart Fitness Watch", slug:"smart-fitness-watch", description:"Track daily activity, workouts and sleep with a bright all-day display.", price:3299, originalPrice:4999, imageUrl:"https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85", stock:18, category:"Electronics", brand:"NovaTech", rating:4.4, reviewCount:86 },
    { name:"Everyday Canvas Sneakers", slug:"everyday-canvas-sneakers", description:"Versatile everyday sneakers designed for comfort and effortless style.", price:1799, originalPrice:2499, imageUrl:"https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85", stock:32, category:"Fashion", brand:"UrbanThread", rating:4.3, reviewCount:73 },
    { name:"Minimal Desk Lamp", slug:"minimal-desk-lamp", description:"A clean, warm desk lamp for study sessions, workspaces and bedside tables.", price:1199, originalPrice:1599, imageUrl:"https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=85", stock:12, category:"Home & Kitchen", brand:"CasaLiving", rating:4.5, reviewCount:51 },
    { name:"The Creative Thinker's Notebook", slug:"creative-thinkers-notebook", description:"A premium hard-cover notebook for ideas, notes, sketches and plans.", price:499, originalPrice:699, imageUrl:"https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=900&q=85", stock:60, category:"Books", brand:"PageTurner", rating:4.7, reviewCount:42 },
    { name:"Daily Hydration Serum", slug:"daily-hydration-serum", description:"A lightweight hydration serum for a fresh, comfortable skin feel.", price:699, originalPrice:999, imageUrl:"https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=900&q=85", stock:40, category:"Beauty & Personal Care", brand:"GlowTheory", rating:4.2, reviewCount:38 },
    { name:"Performance Training Bottle", slug:"performance-training-bottle", description:"A durable reusable bottle for gym sessions, commuting and everyday use.", price:399, originalPrice:599, imageUrl:"https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=900&q=85", stock:50, category:"Sports & Fitness", brand:"ActivePulse", rating:4.5, reviewCount:97 },
    { name:"Compact Bluetooth Speaker", slug:"compact-bluetooth-speaker", description:"Portable sound with a compact design for desks, trips and weekends.", price:1599, originalPrice:2299, imageUrl:"https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=85", stock:16, category:"Electronics", brand:"NovaTech", rating:4.1, reviewCount:64 }
  ];
  for (const { category, brand, ...p } of products) {
    await prisma.product.upsert({
      where: { slug: p.slug }, update: {},
      create: { ...p, price: p.price, originalPrice: p.originalPrice, categoryId: catMap[category], brandId: brandMap[brand] }
    });
  }

  const adminHash = await bcrypt.hash("DemoAdmin!234", 12);
  const userHash = await bcrypt.hash("DemoUser!234", 12);
  await prisma.user.upsert({ where:{email:"admin@shopsphere.demo"}, update:{}, create:{name:"Demo Admin",email:"admin@shopsphere.demo",passwordHash:adminHash,role:Role.ADMIN} });
  await prisma.user.upsert({ where:{email:"customer@shopsphere.demo"}, update:{}, create:{name:"Demo Customer",email:"customer@shopsphere.demo",passwordHash:userHash} });
  console.log("Seed complete.");
}
main().finally(() => prisma.$disconnect());
