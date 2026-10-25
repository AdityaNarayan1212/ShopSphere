import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient, Prisma, Role, OrderStatus, PaymentMethod } from "@prisma/client";
import { z } from "zod";
import swaggerUi from "swagger-ui-express";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import crypto from "node:crypto";

const app = express();
const prisma = new PrismaClient();
const port = Number(process.env.PORT || 4000);
const isProd = process.env.NODE_ENV === "production";
if (isProd) {
  if (!process.env.DATABASE_URL) {
    throw new Error("FATAL: DATABASE_URL is required when NODE_ENV=production.");
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("FATAL: JWT_SECRET must be at least 32 characters when NODE_ENV=production.");
  }
} else if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.warn("WARNING: set JWT_SECRET to a random secret of at least 32 characters.");
}
const jwtSecret: string = isProd ? process.env.JWT_SECRET! : (process.env.JWT_SECRET || "development-only-secret-change-me");
app.use(helmet());
app.use(cors({ origin: (process.env.CLIENT_ORIGIN || "http://localhost:5173").split(",").map(s => s.trim()), credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(JSON.stringify({ method: req.method, path: req.originalUrl.split("?")[0], status: res.statusCode, ms: Date.now() - start }));
  });
  next();
});
app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 1));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));

type AuthRequest = Request & { user?: { id: string; role: Role; email: string } };
const signToken = (u: { id: string; role: Role; email: string }) => jwt.sign({ id: u.id, role: u.role, email: u.email }, jwtSecret, { expiresIn: (process.env.JWT_EXPIRES_IN || "1d") as jwt.SignOptions["expiresIn"] });

function auth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Authentication required" });
  try {
    req.user = jwt.verify(header.slice(7), jwtSecret) as AuthRequest["user"];
    next();
  } catch { return res.status(401).json({ error: "Invalid or expired token" }); }
}
function admin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== Role.ADMIN) return res.status(403).json({ error: "Administrator access required" });
  next();
}
const asyncRoute = (fn: (req: AuthRequest, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req as AuthRequest, res, next)).catch(next);
const addressSchema = z.object({
  label: z.string().max(40).default("Home"), recipient: z.string().min(2).max(100),
  line1: z.string().min(3).max(200), line2: z.string().max(200).optional(),
  city: z.string().min(2).max(100), state: z.string().min(2).max(100),
  postalCode: z.string().min(4).max(12), country: z.string().default("India"),
  phone: z.string().min(8).max(20)
});
const productInclude = { category: true, brand: true } as const;

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "shopsphere-api", timestamp: new Date().toISOString() }));
app.get("/api/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "up", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "error", db: "down", timestamp: new Date().toISOString() });
  }
});
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup({
  openapi: "3.0.0", info: { title: "ShopSphere API", version: "1.0.0" },
  servers: [{ url: "http://localhost:4000" }],
  paths: {
    "/api/products": { get: { summary: "List/search products", parameters: [{in:"query",name:"q",schema:{type:"string"}},{in:"query",name:"category",schema:{type:"string"}},{in:"query",name:"sort",schema:{type:"string"}}], responses:{"200":{description:"Product page"}} } },
    "/api/auth/register": { post: { summary: "Register customer", responses:{"201":{description:"Created"},"400":{description:"Validation error"}} } },
    "/api/auth/login": { post: { summary: "Login", responses:{"200":{description:"JWT token"}} } },
    "/api/orders": { post: { summary: "Create order", responses:{"201":{description:"Order created"}} } }
  }
}));

app.post("/api/auth/register", asyncRoute(async (req, res) => {
  const schema = z.object({ name:z.string().min(2).max(80), email:z.string().email(), password:z.string().min(8).max(100) });
  const input = schema.parse(req.body);
  const exists = await prisma.user.findUnique({ where:{email:input.email.toLowerCase()} });
  if (exists) return res.status(409).json({ error:"An account with this email already exists" });
  const user = await prisma.user.create({ data:{ name:input.name, email:input.email.toLowerCase(), passwordHash:await bcrypt.hash(input.password, 12) } });
  return res.status(201).json({ token:signToken({ id: user.id, role: user.role, email: user.email }), user:{id:user.id,name:user.name,email:user.email,role:user.role} });
}));
app.post("/api/auth/login", asyncRoute(async (req, res) => {
  const input = z.object({ email:z.string().email(), password:z.string().min(1) }).parse(req.body);
  const user = await prisma.user.findUnique({ where:{email:input.email.toLowerCase()} });
  if (!user || !user.active || !(await bcrypt.compare(input.password,user.passwordHash))) return res.status(401).json({error:"Email or password is incorrect"});
  return res.json({ token:signToken({ id: user.id, role: user.role, email: user.email }), user:{id:user.id,name:user.name,email:user.email,role:user.role} });
}));
app.get("/api/auth/me", auth, asyncRoute(async (req,res) => {
  const user = await prisma.user.findUnique({where:{id:req.user!.id},select:{id:true,name:true,email:true,role:true,active:true}});
  if (!user || !user.active) return res.status(401).json({error:"Account unavailable"});
  res.json({user});
}));
app.post("/api/auth/logout", auth, (_req,res) => res.json({message:"Logged out. Remove the token from the client."}));

app.get("/api/categories", asyncRoute(async (_req,res) => res.json(await prisma.category.findMany({orderBy:{name:"asc"}}))));
app.get("/api/brands", asyncRoute(async (_req,res) => res.json(await prisma.brand.findMany({orderBy:{name:"asc"}}))));
app.get("/api/products", asyncRoute(async (req,res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(48, Math.max(1, Number(req.query.limit || 12)));
  const q = String(req.query.q || "").trim();
  const where: Prisma.ProductWhereInput = { active:true };
  if (q) where.OR = [{name:{contains:q,mode:"insensitive"}},{description:{contains:q,mode:"insensitive"}},{brand:{name:{contains:q,mode:"insensitive"}}}];
  if (req.query.category) where.category = { slug:String(req.query.category) };
  if (req.query.brand) where.brand = { name:String(req.query.brand) };
  if (req.query.minPrice || req.query.maxPrice) where.price = { ...(req.query.minPrice ? {gte:new Prisma.Decimal(String(req.query.minPrice))}:{}), ...(req.query.maxPrice ? {lte:new Prisma.Decimal(String(req.query.maxPrice))}:{}) };
  if (req.query.inStock === "true") where.stock = {gt:0};
  if (req.query.rating) where.rating = {gte:Number(req.query.rating)};
  const sort = String(req.query.sort || "popular");
  const orderBy: Prisma.ProductOrderByWithRelationInput = sort === "price-asc" ? {price:"asc"} : sort === "price-desc" ? {price:"desc"} : sort === "newest" ? {createdAt:"desc"} : sort === "rating" ? {rating:"desc"} : {reviewCount:"desc"};
  const [items,total] = await prisma.$transaction([
    prisma.product.findMany({where,include:productInclude,orderBy,skip:(page-1)*limit,take:limit}),
    prisma.product.count({where})
  ]);
  res.json({items,total,page,limit,pages:Math.ceil(total/limit)});
}));
app.get("/api/products/:id", asyncRoute(async (req,res) => {
  const product = await prisma.product.findFirst({where:{OR:[{id:req.params.id},{slug:req.params.id}],active:true},include:productInclude});
  if (!product) return res.status(404).json({error:"Product not found"});
  const related = await prisma.product.findMany({where:{categoryId:product.categoryId,active:true,id:{not:product.id}},include:productInclude,take:4});
  res.json({product,related});
}));
app.get("/api/products/:id/reviews", asyncRoute(async (req,res) => {
  const reviews = await prisma.review.findMany({where:{productId:req.params.id},include:{user:{select:{name:true}}},orderBy:{createdAt:"desc"}});
  res.json(reviews);
}));
app.post("/api/products/:id/reviews", auth, asyncRoute(async (req,res) => {
  const input = z.object({rating:z.number().int().min(1).max(5),title:z.string().max(100).optional(),comment:z.string().min(3).max(1000)}).parse(req.body);
  const purchased = await prisma.orderItem.findFirst({where:{productId:req.params.id,order:{userId:req.user!.id,status:{in:["DELIVERED","SHIPPED"]}}}});
  if (!purchased) return res.status(403).json({error:"You can review a product after purchasing it"});
  const review = await prisma.review.upsert({where:{userId_productId:{userId:req.user!.id,productId:req.params.id}},update:input,create:{...input,userId:req.user!.id,productId:req.params.id}});
  const agg = await prisma.review.aggregate({where:{productId:req.params.id},_avg:{rating:true},_count:true});
  await prisma.product.update({where:{id:req.params.id},data:{rating:agg._avg.rating || 0,reviewCount:agg._count}});
  res.status(201).json(review);
}));

app.get("/api/cart", auth, asyncRoute(async (req,res) => {
  const items = await prisma.cartItem.findMany({where:{userId:req.user!.id},include:{product:{include:productInclude}},orderBy:{createdAt:"desc"}});
  res.json({items,total:items.reduce((sum,i)=>sum+Number(i.product.price)*i.quantity,0)});
}));
app.post("/api/cart/items", auth, asyncRoute(async (req,res) => {
  const input = z.object({productId:z.string(),quantity:z.number().int().min(1).max(20).default(1)}).parse(req.body);
  const product = await prisma.product.findFirst({where:{id:input.productId,active:true}});
  if (!product) return res.status(404).json({error:"Product not found"});
  if (product.stock < input.quantity) return res.status(409).json({error:"Not enough stock available"});
  const current = await prisma.cartItem.findUnique({where:{userId_productId:{userId:req.user!.id,productId:product.id}}});
  const quantity = (current?.quantity || 0) + input.quantity;
  if (quantity > product.stock) return res.status(409).json({error:"Requested quantity exceeds available stock"});
  const item = await prisma.cartItem.upsert({where:{userId_productId:{userId:req.user!.id,productId:product.id}},update:{quantity},create:{userId:req.user!.id,productId:product.id,quantity}});
  res.status(201).json(item);
}));
app.patch("/api/cart/items/:id", auth, asyncRoute(async (req,res) => {
  const qty = z.number().int().min(1).max(20).parse(req.body.quantity);
  const item = await prisma.cartItem.findFirst({where:{id:req.params.id,userId:req.user!.id},include:{product:true}});
  if (!item) return res.status(404).json({error:"Cart item not found"});
  if (qty > item.product.stock) return res.status(409).json({error:"Quantity exceeds stock"});
  res.json(await prisma.cartItem.update({where:{id:item.id},data:{quantity:qty}}));
}));
app.delete("/api/cart/items/:id", auth, asyncRoute(async (req,res) => {
  const item = await prisma.cartItem.findFirst({where:{id:req.params.id,userId:req.user!.id}});
  if (!item) return res.status(404).json({error:"Cart item not found"});
  await prisma.cartItem.delete({where:{id:item.id}});
  res.status(204).end();
}));

app.get("/api/wishlist", auth, asyncRoute(async (req,res) => res.json(await prisma.wishlistItem.findMany({where:{userId:req.user!.id},include:{product:{include:productInclude}}}))));
app.post("/api/wishlist/items", auth, asyncRoute(async (req,res) => {
  const input = z.object({productId:z.string()}).parse(req.body);
  res.status(201).json(await prisma.wishlistItem.upsert({where:{userId_productId:{userId:req.user!.id,productId:input.productId}},update:{},create:{userId:req.user!.id,productId:input.productId}}));
}));
app.delete("/api/wishlist/items/:id", auth, asyncRoute(async (req,res) => {
  const item = await prisma.wishlistItem.findFirst({where:{id:req.params.id,userId:req.user!.id}});
  if (!item) return res.status(404).json({error:"Wishlist item not found"});
  await prisma.wishlistItem.delete({where:{id:item.id}});
  res.status(204).end();
}));

app.get("/api/addresses", auth, asyncRoute(async (req,res) => res.json(await prisma.address.findMany({where:{userId:req.user!.id},orderBy:{createdAt:"desc"}}))));
app.post("/api/addresses", auth, asyncRoute(async (req,res) => {
  const input = addressSchema.parse(req.body);
  res.status(201).json(await prisma.address.create({data:{...input,userId:req.user!.id}}));
}));

app.post("/api/orders", auth, asyncRoute(async (req,res) => {
  const input = z.object({addressId:z.string(),paymentMethod:z.nativeEnum(PaymentMethod)}).parse(req.body);
  const address = await prisma.address.findFirst({where:{id:input.addressId,userId:req.user!.id}});
  if (!address) return res.status(400).json({error:"Choose a valid delivery address"});
  const order = await prisma.$transaction(async tx => {
    const cart = await tx.cartItem.findMany({where:{userId:req.user!.id},include:{product:true}});
    if (!cart.length) throw Object.assign(new Error("Your cart is empty"),{status:400});
    let subtotal = new Prisma.Decimal(0);
    for (const item of cart) {
      const fresh = await tx.product.findUnique({where:{id:item.productId}});
      if (!fresh || !fresh.active || fresh.stock < item.quantity) throw Object.assign(new Error(`Insufficient stock for ${item.product.name}`),{status:409});
      const line = fresh.price.mul(item.quantity);
      subtotal = subtotal.add(line);
      await tx.product.update({where:{id:fresh.id},data:{stock:{decrement:item.quantity}}});
      await tx.inventoryMovement.create({data:{productId:fresh.id,delta:-item.quantity,reason:"ORDER_PLACED"}});
    }
    const shipping = subtotal.gte(999) ? new Prisma.Decimal(0) : new Prisma.Decimal(49);
    const total = subtotal.add(shipping);
    const created = await tx.order.create({data:{
      orderNumber:`SS-${Date.now().toString().slice(-7)}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`,
      userId:req.user!.id,addressId:address.id,paymentMethod:input.paymentMethod,subtotal,shipping,total,
      items:{create:cart.map(i=>({productId:i.productId,productName:i.product.name,unitPrice:i.product.price,quantity:i.quantity,lineTotal:i.product.price.mul(i.quantity)}))}
    },include:{items:true,address:true}});
    await tx.payment.create({data:{orderId:created.id,method:input.paymentMethod,status:"PENDING",amount:total}});
    await tx.cartItem.deleteMany({where:{userId:req.user!.id}});
    return created;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  await notifyOrder(`ShopSphere order ${order.orderNumber} created. Total: INR ${order.total.toString()}`);
  res.status(201).json({order,paymentNotice:input.paymentMethod==="MOCK"?"Demo payment simulation only. No real money was charged.":"Cash on Delivery selected."});
}));
app.get("/api/orders", auth, asyncRoute(async (req,res) => res.json(await prisma.order.findMany({where:{userId:req.user!.id},include:{items:true},orderBy:{createdAt:"desc"}}))));
app.get("/api/orders/:id", auth, asyncRoute(async (req,res) => {
  const order = await prisma.order.findFirst({where:{id:req.params.id,userId:req.user!.id},include:{items:true,address:true}});
  if (!order) return res.status(404).json({error:"Order not found"});
  res.json(order);
}));
app.post("/api/orders/:id/cancel", auth, asyncRoute(async (req,res) => {
  const order = await prisma.$transaction(async tx => {
    const found = await tx.order.findFirst({where:{id:req.params.id,userId:req.user!.id},include:{items:true}});
    if (!found) throw Object.assign(new Error("Order not found"),{status:404});
    if (!["PENDING","CONFIRMED"].includes(found.status)) throw Object.assign(new Error("This order can no longer be cancelled"),{status:409});
    for (const item of found.items) {
      await tx.product.update({where:{id:item.productId},data:{stock:{increment:item.quantity}}});
      await tx.inventoryMovement.create({data:{productId:item.productId,delta:item.quantity,reason:"ORDER_CANCELLED"}});
    }
    return tx.order.update({where:{id:found.id},data:{status:OrderStatus.CANCELLED},include:{items:true}});
  });
  res.json(order);
}));

app.get("/api/admin/dashboard", auth, admin, asyncRoute(async (_req,res) => {
  const [products,customers,orders,pending,lowStock,recent,revenue] = await Promise.all([
    prisma.product.count({where:{active:true}}), prisma.user.count({where:{role:Role.CUSTOMER}}),
    prisma.order.count(), prisma.order.count({where:{status:{in:["PENDING","CONFIRMED"]}}}),
    prisma.product.findMany({where:{active:true,stock:{lte:5}},include:productInclude,orderBy:{stock:"asc"},take:8}),
    prisma.order.findMany({include:{user:{select:{name:true,email:true}},items:true},orderBy:{createdAt:"desc"},take:8}),
    prisma.order.aggregate({where:{status:{not:"CANCELLED"},paymentStatus:{not:"FAILED"}},_sum:{total:true}})
  ]);
  res.json({products,customers,orders,pending,lowStock,recent,revenue:Number(revenue._sum.total || 0)});
}));
app.post("/api/admin/products", auth, admin, asyncRoute(async (req,res) => {
  const input = z.object({name:z.string().min(2),slug:z.string().min(2).regex(/^[a-z0-9-]+$/),description:z.string().min(5),price:z.number().positive(),originalPrice:z.number().positive().optional(),imageUrl:z.string().url(),stock:z.number().int().min(0),categoryId:z.string(),brandId:z.string()}).parse(req.body);
  res.status(201).json(await prisma.product.create({data:input,include:productInclude}));
}));
app.patch("/api/admin/products/:id", auth, admin, asyncRoute(async (req,res) => {
  const input = z.object({name:z.string().min(2).optional(),description:z.string().min(5).optional(),price:z.number().positive().optional(),originalPrice:z.number().positive().nullable().optional(),imageUrl:z.string().url().optional(),stock:z.number().int().min(0).optional(),categoryId:z.string().optional(),brandId:z.string().optional(),active:z.boolean().optional()}).parse(req.body);
  const old = await prisma.product.findUnique({where:{id:req.params.id}});
  if (!old) return res.status(404).json({error:"Product not found"});
  if (input.stock !== undefined && input.stock !== old.stock) await prisma.inventoryMovement.create({data:{productId:old.id,delta:input.stock-old.stock,reason:"ADMIN_STOCK_ADJUSTMENT"}});
  res.json(await prisma.product.update({where:{id:old.id},data:input,include:productInclude}));
}));
app.delete("/api/admin/products/:id", auth, admin, asyncRoute(async (req,res) => {
  const product = await prisma.product.findUnique({where:{id:req.params.id}});
  if (!product) return res.status(404).json({error:"Product not found"});
  await prisma.product.update({where:{id:product.id},data:{active:false}});
  res.json({message:"Product deactivated"});
}));
app.get("/api/admin/orders", auth, admin, asyncRoute(async (req,res) => {
  const status = req.query.status ? {status:String(req.query.status) as OrderStatus} : {};
  res.json(await prisma.order.findMany({where:status,include:{user:{select:{name:true,email:true}},items:true,address:true},orderBy:{createdAt:"desc"},take:100}));
}));
app.patch("/api/admin/orders/:id/status", auth, admin, asyncRoute(async (req,res) => {
  const input = z.object({status:z.nativeEnum(OrderStatus)}).parse(req.body);
  const order = await prisma.order.findUnique({where:{id:req.params.id}});
  if (!order) return res.status(404).json({error:"Order not found"});
  const transitions: Record<OrderStatus, OrderStatus[]> = {
    PENDING:["CONFIRMED","CANCELLED"], CONFIRMED:["PROCESSING","CANCELLED"],
    PROCESSING:["SHIPPED"], SHIPPED:["DELIVERED"], DELIVERED:[], CANCELLED:[]
  };
  if (input.status !== order.status && !transitions[order.status].includes(input.status)) return res.status(409).json({error:`Cannot change ${order.status} to ${input.status}`});
  res.json(await prisma.order.update({where:{id:order.id},data:{status:input.status}}));
}));
app.get("/api/admin/customers", auth, admin, asyncRoute(async (_req,res) => res.json(await prisma.user.findMany({where:{role:Role.CUSTOMER},select:{id:true,name:true,email:true,active:true,createdAt:true,_count:{select:{orders:true}}},orderBy:{createdAt:"desc"},take:200}))));
app.patch("/api/admin/customers/:id/active", auth, admin, asyncRoute(async (req,res) => {
  const active = z.boolean().parse(req.body.active);
  const customer = await prisma.user.findFirst({where:{id:req.params.id,role:Role.CUSTOMER}});
  if (!customer) return res.status(404).json({error:"Customer not found"});
  res.json(await prisma.user.update({where:{id:customer.id},data:{active},select:{id:true,name:true,email:true,active:true}}));
}));

app.post("/api/admin/uploads/presign", auth, admin, asyncRoute(async (req,res) => {
  const input = z.object({fileName:z.string().min(1).max(150),contentType:z.enum(["image/jpeg","image/png","image/webp"])}).parse(req.body);
  const bucket = process.env.S3_BUCKET;
  if (!bucket) return res.status(503).json({error:"S3 uploads are not configured. Set S3_BUCKET in the backend environment."});
  const ext = input.contentType.split("/")[1].replace("jpeg","jpg");
  const key = `products/${crypto.randomUUID()}.${ext}`;
  const client = new S3Client({region:process.env.AWS_REGION || "ap-south-1"});
  const uploadUrl = await getSignedUrl(client,new PutObjectCommand({Bucket:bucket,Key:key,ContentType:input.contentType}),{expiresIn:300});
  const assetsBaseUrl = process.env.ASSETS_BASE_URL?.replace(/\/+$/, "");
  res.json({uploadUrl,key,expiresIn:300,...(assetsBaseUrl ? {publicUrl:`${assetsBaseUrl}/${key}`} : {})});
}));

async function notifyOrder(message:string) {
  if (!process.env.SNS_ORDER_TOPIC_ARN) { console.info("[order-notification]",message); return; }
  try {
    const sns = new SNSClient({region:process.env.AWS_REGION || "ap-south-1"});
    await sns.send(new PublishCommand({TopicArn:process.env.SNS_ORDER_TOPIC_ARN,Message:message,Subject:"ShopSphere order update"}));
  } catch (e) { console.error("SNS notification failed",e); }
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof z.ZodError) return res.status(400).json({error:"Validation failed",details:err.issues.map(i=>({path:i.path.join("."),message:i.message}))});
  const e = err as {status?:number;code?:string;message?:string};
  if (e.code === "P2002") return res.status(409).json({error:"A record with this value already exists"});
  if (e.code === "P2025") return res.status(404).json({error:"Record not found"});
  const status = e.status || 500;
  if (status >= 500) console.error(err);
  return res.status(status).json({error:status >= 500 ? "Internal server error" : (e.message || "Request failed")});
});
const server = app.listen(port, () => console.log(`ShopSphere API listening on ${port}`));
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}, shutting down gracefully...`);
  await new Promise<void>(resolve => server.close(() => resolve()));
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
