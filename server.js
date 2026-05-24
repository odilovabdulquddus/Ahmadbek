const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const FILES = {
  users: path.join(DATA_DIR, 'users.json'),
  orders: path.join(DATA_DIR, 'orders.json'),
  rooms: path.join(DATA_DIR, 'rooms.json'),
  products: path.join(DATA_DIR, 'products.json')
};
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const ROOM_COUNT = 15;
const ROOM_CLEANING_BUFFER = 10;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.env': 'text/plain; charset=utf-8'
};
const sessions = new Map();

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const filePath of Object.values(FILES)) {
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '[]', 'utf8');
  }
}

function readJsonArray(filePath, fallback = []) {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonArray(filePath, list) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(Array.isArray(list) ? list : [], null, 2), 'utf8');
}

function padNumber(value) {
  return String(value).padStart(2, '0');
}

function getTodayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${padNumber(now.getMonth() + 1)}-${padNumber(now.getDate())}`;
}

function timeToMinutes(time) {
  if (!time) return 0;
  const [h, m] = String(time).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    avatar: user.avatar || 'https://via.placeholder.com/60',
    blocked: Boolean(user.blocked),
    maxOrder: Number.isFinite(Number(user.maxOrder)) ? Number(user.maxOrder) : 100,
    isAdmin: Boolean(user.isAdmin),
    createdAt: user.createdAt || new Date().toISOString()
  };
}

function sanitizeProduct(product, index = 0) {
  const fallbackName = String(product?.name?.uz || product?.name || `Mahsulot ${index + 1}`);
  const fallbackWeight = product?.weight && typeof product.weight === 'object'
    ? product.weight
    : { uz: String(product?.weight || '1 Dona'), ru: String(product?.weight || '1 шт'), en: String(product?.weight || '1 pc') };

  return {
    id: String(product?.id || generateId('product')),
    cat: String(product?.cat || 'all'),
    name: {
      uz: String(product?.name?.uz || product?.name || fallbackName),
      ru: String(product?.name?.ru || product?.name || fallbackName),
      en: String(product?.name?.en || product?.name || fallbackName)
    },
    weight: {
      uz: String(fallbackWeight.uz || '1 Dona'),
      ru: String(fallbackWeight.ru || '1 шт'),
      en: String(fallbackWeight.en || '1 pc')
    },
    price: Math.max(0, Number(product?.price) || 0),
    ...(Number.isFinite(Number(product?.price2)) && Number(product.price2) > 0 ? { price2: Number(product.price2) } : {}),
    img: String(product?.img || 'Menyu/'),
    quantity: 0
  };
}

function normalizeOrder(order, fallbackId = 1) {
  const id = Number.isFinite(Number(order?.id)) ? Number(order.id) : fallbackId;
  return {
    id,
    customer: String(order?.customer || ''),
    phone: String(order?.phone || ''),
    address: String(order?.address || ''),
    note: String(order?.note || ''),
    userId: String(order?.userId || ''),
    courier: Boolean(order?.courier),
    mapUrl: String(order?.mapUrl || ''),
    items: Array.isArray(order?.items) ? order.items.map((item) => ({
      name: String(item?.name || ''),
      weight: item?.weight && typeof item.weight === 'object' ? item.weight : { uz: String(item?.weight || ''), ru: String(item?.weight || ''), en: String(item?.weight || '') },
      quantity: Math.max(0, Number(item?.quantity) || 0),
      price: Math.max(0, Number(item?.price) || 0),
      total: Math.max(0, Number(item?.total) || ((Number(item?.price) || 0) * (Number(item?.quantity) || 0)))
    })) : [],
    total: Math.max(0, Number(order?.total) || 0),
    status: String(order?.status || 'preparing'),
    orderTime: order?.orderTime || new Date().toISOString()
  };
}

function updateOrderStatuses(list) {
  const now = Date.now();
  let changed = false;
  list.forEach((order) => {
    if (order.status !== 'preparing' || !order.orderTime) return;
    const diffMinutes = (now - new Date(order.orderTime).getTime()) / (1000 * 60);
    if (diffMinutes >= 10) {
      order.status = order.courier ? 'courier' : 'ready';
      changed = true;
    }
  });
  return changed;
}

function createDefaultRooms() {
  return Array.from({ length: ROOM_COUNT }, (_, index) => ({
    id: index + 1,
    number: index + 1,
    bookings: []
  }));
}

function normalizeBooking(input, roomId) {
  if (!input) return null;
  const date = String(input.date || '').trim();
  const startTime = String(input.startTime || '').trim();
  const endTime = String(input.endTime || '').trim();
  if (!date || !startTime || !endTime || startTime >= endTime) return null;
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  return {
    id: String(input.id || generateId(`booking_${roomId}`)),
    roomId: Number(roomId),
    userId: String(input.userId || ''),
    name: String(input.name || ''),
    phone: String(input.phone || ''),
    date,
    startTime,
    endTime,
    cleaningStartMin: Math.max(0, startMinutes - ROOM_CLEANING_BUFFER),
    cleaningEndMin: Math.min(24 * 60, endMinutes + ROOM_CLEANING_BUFFER),
    cleaningEnd: `${padNumber(Math.floor(Math.min(24 * 60 - 1, endMinutes + ROOM_CLEANING_BUFFER) / 60))}:${padNumber(Math.min(24 * 60 - 1, endMinutes + ROOM_CLEANING_BUFFER) % 60)}`,
    createdAt: input.createdAt || new Date().toISOString()
  };
}

function normalizeRoom(input, index) {
  const roomId = Number(input?.id) || index + 1;
  const bookings = [];
  if (Array.isArray(input?.bookings)) {
    input.bookings.forEach((booking) => {
      const normalized = normalizeBooking(booking, roomId);
      if (normalized) bookings.push(normalized);
    });
  }
  return {
    id: roomId,
    number: Number(input?.number) || roomId,
    bookings
  };
}

function pruneExpiredRoomBookings(rooms) {
  const today = getTodayDate();
  const minutes = new Date().getHours() * 60 + new Date().getMinutes();
  let changed = false;
  rooms.forEach((room) => {
    const before = room.bookings.length;
    room.bookings = room.bookings.filter((booking) => {
      if (booking.date < today) return false;
      if (booking.date === today && booking.cleaningEndMin <= minutes) return false;
      return true;
    });
    if (room.bookings.length !== before) changed = true;
  });
  return changed;
}

function readUsers() {
  return readJsonArray(FILES.users, []);
}

function writeUsers(users) {
  writeJsonArray(FILES.users, users);
}

function readProducts() {
  const list = readJsonArray(FILES.products, []);
  const normalized = list.map((product, index) => sanitizeProduct(product, index));
  if (JSON.stringify(list) !== JSON.stringify(normalized)) writeJsonArray(FILES.products, normalized);
  return normalized;
}

function writeProducts(products) {
  writeJsonArray(FILES.products, products.map((product, index) => sanitizeProduct(product, index)));
}

function readOrders() {
  const list = readJsonArray(FILES.orders, []).map((order, index) => normalizeOrder(order, index + 1));
  const changed = updateOrderStatuses(list);
  if (changed) writeJsonArray(FILES.orders, list);
  return list;
}

function writeOrders(orders) {
  writeJsonArray(FILES.orders, orders.map((order, index) => normalizeOrder(order, index + 1)));
}

function readRooms() {
  const raw = readJsonArray(FILES.rooms, []);
  const source = raw.length ? raw : createDefaultRooms();
  const rooms = createDefaultRooms().map((room, index) => normalizeRoom(source[index] || room, index));
  const changed = pruneExpiredRoomBookings(rooms) || raw.length !== rooms.length || JSON.stringify(raw) !== JSON.stringify(rooms);
  if (changed) writeJsonArray(FILES.rooms, rooms);
  return rooms;
}

function writeRooms(rooms) {
  const normalized = createDefaultRooms().map((room, index) => normalizeRoom(rooms[index] || room, index));
  writeJsonArray(FILES.rooms, normalized);
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024 * 12) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function scryptAsync(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey.toString('hex'));
    });
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scryptAsync(password, salt);
  return `${salt}:${hash}`;
}

async function verifyPassword(password, stored) {
  const [salt, savedHash] = String(stored || '').split(':');
  if (!salt || !savedHash) return false;
  const hash = await scryptAsync(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(savedHash, 'hex'));
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (!session || session.expiresAt <= now) sessions.delete(token);
  }
}

function getBearerToken(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

function getSessionUser(req) {
  cleanupExpiredSessions();
  const token = getBearerToken(req);
  if (!token) return { token: null, user: null };
  const session = sessions.get(token);
  if (!session) return { token, user: null };
  const user = readUsers().find((item) => item.id === session.userId) || null;
  if (!user) {
    sessions.delete(token);
    return { token, user: null };
  }
  return { token, user };
}

function requireAuth(req, res) {
  const auth = getSessionUser(req);
  if (!auth.token || !auth.user) {
    sendError(res, 401, 'Unauthorized');
    return null;
  }
  return auth;
}

function requireAdmin(req, res) {
  const auth = requireAuth(req, res);
  if (!auth) return null;
  if (!auth.user.isAdmin) {
    sendError(res, 403, 'Forbidden');
    return null;
  }
  return auth;
}

function isValidUzbekPhone(phone) {
  const cleanPhone = String(phone || '').replace(/\s/g, '');
  const operators = new Set(['33', '88', '90', '91', '93', '94', '95', '97', '98', '99']);
  return cleanPhone.startsWith('+998') && cleanPhone.length === 13 && operators.has(cleanPhone.slice(4, 6));
}

function serveStaticFile(req, res, pathname) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(ROOT_DIR, safePath));
  if (!filePath.startsWith(ROOT_DIR)) {
    sendError(res, 403, 'Forbidden');
    return;
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (safePath !== '/index.html' && !path.extname(safePath)) {
        serveStaticFile(req, res, '/index.html');
        return;
      }
      sendError(res, 404, 'Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const isImage = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico'].includes(ext);
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html'
        ? 'no-store'
        : isImage
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=3600'
    });
    res.end(content);
  });
}

async function handleRegister(req, res) {
  const body = await parseBody(req);
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const password = String(body.password || '').trim();

  if (!name) return sendError(res, 400, 'Name is required');
  if (!isValidUzbekPhone(phone)) return sendError(res, 400, 'Invalid phone');
  if (password.length < 4) return sendError(res, 400, 'Password must be at least 4 characters');

  const users = readUsers();
  if (users.some((user) => user.phone === phone)) return sendError(res, 409, 'Phone already exists');

  const newUser = {
    id: generateId('user'),
    name,
    phone,
    passwordHash: await hashPassword(password),
    avatar: 'https://via.placeholder.com/60',
    blocked: false,
    maxOrder: 100,
    isAdmin: false,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  writeUsers(users);
  const token = createSession(newUser.id);
  sendJson(res, 201, { token, user: sanitizeUser(newUser) });
}

async function handleLogin(req, res) {
  const body = await parseBody(req);
  const phone = String(body.phone || '').trim();
  const password = String(body.password || '').trim();
  const users = readUsers();
  const user = users.find((item) => item.phone === phone);

  if (!user) return sendError(res, 401, 'Invalid phone or password');
  if (!(await verifyPassword(password, user.passwordHash))) return sendError(res, 401, 'Invalid phone or password');
  if (user.blocked) return sendError(res, 403, 'User is blocked');

  const token = createSession(user.id);
  sendJson(res, 200, { token, user: sanitizeUser(user) });
}

async function handleUpdateMe(req, res, auth) {
  const body = await parseBody(req);
  const users = readUsers();
  const user = users.find((item) => item.id === auth.user.id);
  if (!user) return sendError(res, 404, 'User not found');

  const name = body.name === undefined ? user.name : String(body.name || '').trim();
  const phone = body.phone === undefined ? user.phone : String(body.phone || '').trim();
  const avatar = body.avatar === undefined ? user.avatar : String(body.avatar || '').trim();

  if (!name) return sendError(res, 400, 'Name is required');
  if (!isValidUzbekPhone(phone)) return sendError(res, 400, 'Invalid phone');
  const duplicate = users.find((item) => item.phone === phone && item.id !== user.id);
  if (duplicate) return sendError(res, 409, 'Phone already exists');

  user.name = name;
  user.phone = phone;
  user.avatar = avatar || user.avatar || 'https://via.placeholder.com/60';
  writeUsers(users);
  sendJson(res, 200, { user: sanitizeUser(user) });
}

async function handleAdminUserUpdate(req, res, auth, userId) {
  const body = await parseBody(req);
  const users = readUsers();
  const user = users.find((item) => item.id === userId);
  if (!user) return sendError(res, 404, 'User not found');

  if (body.name !== undefined) {
    const nextName = String(body.name || '').trim();
    if (!nextName) return sendError(res, 400, 'Name is required');
    user.name = nextName;
  }
  if (body.phone !== undefined) {
    const nextPhone = String(body.phone || '').trim();
    if (!isValidUzbekPhone(nextPhone)) return sendError(res, 400, 'Invalid phone');
    const duplicate = users.find((item) => item.phone === nextPhone && item.id !== user.id);
    if (duplicate) return sendError(res, 409, 'Phone already exists');
    user.phone = nextPhone;
  }
  if (body.avatar !== undefined) user.avatar = String(body.avatar || '').trim() || user.avatar;
  if (body.blocked !== undefined) user.blocked = Boolean(body.blocked);
  if (body.maxOrder !== undefined) {
    const nextMaxOrder = Number(body.maxOrder);
    if (!Number.isFinite(nextMaxOrder) || nextMaxOrder < 1) return sendError(res, 400, 'Invalid maxOrder');
    user.maxOrder = Math.floor(nextMaxOrder);
  }
  if (body.isAdmin !== undefined) {
    const nextAdmin = Boolean(body.isAdmin);
    if (nextAdmin) users.forEach((item) => { if (item.id !== user.id) item.isAdmin = false; });
    user.isAdmin = nextAdmin;
  }

  writeUsers(users);
  const refreshedCurrentAdmin = users.find((item) => item.id === auth.user.id) || auth.user;
  sendJson(res, 200, {
    user: sanitizeUser(user),
    currentAdmin: sanitizeUser(refreshedCurrentAdmin),
    users: users.map(sanitizeUser)
  });
}

function handleAdminUserDelete(res, auth, userId) {
  const users = readUsers();
  const nextUsers = users.filter((item) => item.id !== userId);
  if (nextUsers.length === users.length) return sendError(res, 404, 'User not found');
  writeUsers(nextUsers);
  for (const [token, session] of sessions.entries()) {
    if (session.userId === userId) sessions.delete(token);
  }
  const refreshedCurrentAdmin = nextUsers.find((item) => item.id === auth.user.id) || auth.user;
  sendJson(res, 200, {
    deletedUserId: userId,
    currentAdmin: sanitizeUser(refreshedCurrentAdmin),
    users: nextUsers.map(sanitizeUser)
  });
}

async function handleProductsBootstrap(req, res) {
  const existing = readProducts();
  if (existing.length) return sendJson(res, 200, { products: existing });
  const body = await parseBody(req);
  const products = Array.isArray(body.products) ? body.products.map((product, index) => sanitizeProduct(product, index)) : [];
  writeProducts(products);
  sendJson(res, 201, { products });
}

async function handleProductCreate(req, res) {
  const body = await parseBody(req);
  const products = readProducts();
  const product = sanitizeProduct(body.product || body, products.length);
  products.push(product);
  writeProducts(products);
  sendJson(res, 201, { product, products });
}

async function handleProductUpdate(req, res, productId) {
  const body = await parseBody(req);
  const products = readProducts();
  const index = products.findIndex((item) => item.id === productId);
  if (index === -1) return sendError(res, 404, 'Product not found');
  const next = sanitizeProduct({ ...products[index], ...(body.product || body), id: productId }, index);
  products[index] = next;
  writeProducts(products);
  sendJson(res, 200, { product: next, products });
}

function handleProductDelete(res, productId) {
  const products = readProducts();
  const nextProducts = products.filter((item) => item.id !== productId);
  if (nextProducts.length === products.length) return sendError(res, 404, 'Product not found');
  writeProducts(nextProducts);
  sendJson(res, 200, { deletedProductId: productId, products: nextProducts });
}

async function handleBulkProductImageUpdate(req, res) {
  const body = await parseBody(req);
  const url = String(body.url || '').trim();
  if (!url) return sendError(res, 400, 'Image URL is required');
  const products = readProducts().map((product) => ({ ...product, img: url }));
  writeProducts(products);
  sendJson(res, 200, { products });
}

function findNextOrderId(orders) {
  return orders.reduce((maxId, order) => Math.max(maxId, Number(order.id) || 0), 0) + 1;
}

async function handleOrdersBootstrap(req, res) {
  const existing = readOrders();
  if (existing.length) return sendJson(res, 200, { orders: existing });
  const body = await parseBody(req);
  const orders = Array.isArray(body.orders) ? body.orders.map((order, index) => normalizeOrder(order, index + 1)) : [];
  writeOrders(orders);
  sendJson(res, 201, { orders });
}

async function handleCreateOrder(req, res, auth) {
  const body = await parseBody(req);
  const orders = readOrders();
  const order = normalizeOrder({
    ...(body.order || body),
    id: findNextOrderId(orders),
    userId: auth.user.id,
    status: 'preparing',
    orderTime: new Date().toISOString()
  }, findNextOrderId(orders));
  orders.push(order);
  writeOrders(orders);
  sendJson(res, 201, { order });
}

function handleDeleteOrder(res, orderId) {
  const orders = readOrders();
  const nextOrders = orders.filter((order) => Number(order.id) !== Number(orderId));
  if (nextOrders.length === orders.length) return sendError(res, 404, 'Order not found');
  writeOrders(nextOrders);
  sendJson(res, 200, { deletedOrderId: Number(orderId), orders: nextOrders });
}

function roomHasBookings(rooms) {
  return rooms.some((room) => Array.isArray(room.bookings) && room.bookings.length);
}

async function handleRoomsBootstrap(req, res) {
  const existing = readRooms();
  if (roomHasBookings(existing)) return sendJson(res, 200, { rooms: existing });
  const body = await parseBody(req);
  const incoming = Array.isArray(body.rooms) ? body.rooms : [];
  const rooms = createDefaultRooms().map((room, index) => normalizeRoom(incoming[index] || room, index));
  writeRooms(rooms);
  sendJson(res, 201, { rooms });
}

function hasRoomConflict(room, booking) {
  return room.bookings.some((existing) =>
    existing.date === booking.date &&
    booking.cleaningStartMin < existing.cleaningEndMin &&
    booking.cleaningEndMin > existing.cleaningStartMin
  );
}

async function handleRoomBooking(req, res, auth, roomId) {
  const body = await parseBody(req);
  const rooms = readRooms();
  const room = rooms.find((item) => Number(item.id) === Number(roomId));
  if (!room) return sendError(res, 404, 'Room not found');
  const booking = normalizeBooking({ ...(body.booking || body), userId: auth.user.id }, room.id);
  if (!booking) return sendError(res, 400, 'Invalid booking');
  if (hasRoomConflict(room, booking)) return sendError(res, 409, 'Room already booked for that time');
  room.bookings.push(booking);
  writeRooms(rooms);
  sendJson(res, 201, { booking, rooms });
}

function handleRoomBookingDelete(res, roomId, bookingId) {
  const rooms = readRooms();
  const room = rooms.find((item) => Number(item.id) === Number(roomId));
  if (!room) return sendError(res, 404, 'Room not found');
  const nextBookings = room.bookings.filter((booking) => booking.id !== bookingId);
  if (nextBookings.length === room.bookings.length) return sendError(res, 404, 'Booking not found');
  room.bookings = nextBookings;
  writeRooms(rooms);
  sendJson(res, 200, { deletedBookingId: bookingId, rooms });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (pathname === '/api/health' && req.method === 'GET') return sendJson(res, 200, { ok: true });

    if (pathname === '/api/auth/register' && req.method === 'POST') return handleRegister(req, res);
    if (pathname === '/api/auth/login' && req.method === 'POST') return handleLogin(req, res);
    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      const token = getBearerToken(req);
      if (token) sessions.delete(token);
      return sendJson(res, 200, { ok: true });
    }
    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const auth = requireAuth(req, res);
      if (!auth) return;
      return sendJson(res, 200, { user: sanitizeUser(auth.user) });
    }
    if (pathname === '/api/auth/me' && req.method === 'PATCH') {
      const auth = requireAuth(req, res);
      if (!auth) return;
      return handleUpdateMe(req, res, auth);
    }

    if (pathname === '/api/users' && req.method === 'GET') {
      const auth = requireAdmin(req, res);
      if (!auth) return;
      return sendJson(res, 200, { users: readUsers().map(sanitizeUser) });
    }
    if (pathname.startsWith('/api/users/') && req.method === 'PATCH') {
      const auth = requireAdmin(req, res);
      if (!auth) return;
      return handleAdminUserUpdate(req, res, auth, pathname.split('/').pop());
    }
    if (pathname.startsWith('/api/users/') && req.method === 'DELETE') {
      const auth = requireAdmin(req, res);
      if (!auth) return;
      return handleAdminUserDelete(res, auth, pathname.split('/').pop());
    }

    if (pathname === '/api/products' && req.method === 'GET') return sendJson(res, 200, { products: readProducts() });
    if (pathname === '/api/products/bootstrap' && req.method === 'POST') return handleProductsBootstrap(req, res);
    if (pathname === '/api/products' && req.method === 'POST') {
      const auth = requireAdmin(req, res);
      if (!auth) return;
      return handleProductCreate(req, res);
    }
    if (pathname === '/api/products/images' && req.method === 'PATCH') {
      const auth = requireAdmin(req, res);
      if (!auth) return;
      return handleBulkProductImageUpdate(req, res);
    }
    if (pathname.startsWith('/api/products/') && req.method === 'PATCH') {
      const auth = requireAdmin(req, res);
      if (!auth) return;
      return handleProductUpdate(req, res, decodeURIComponent(pathname.split('/').pop()));
    }
    if (pathname.startsWith('/api/products/') && req.method === 'DELETE') {
      const auth = requireAdmin(req, res);
      if (!auth) return;
      return handleProductDelete(res, decodeURIComponent(pathname.split('/').pop()));
    }

    if (pathname === '/api/orders/bootstrap' && req.method === 'POST') return handleOrdersBootstrap(req, res);
    if (pathname === '/api/orders/mine' && req.method === 'GET') {
      const auth = requireAuth(req, res);
      if (!auth) return;
      return sendJson(res, 200, { orders: readOrders().filter((order) => String(order.userId) === String(auth.user.id)) });
    }
    if (pathname === '/api/orders' && req.method === 'GET') {
      const auth = requireAdmin(req, res);
      if (!auth) return;
      return sendJson(res, 200, { orders: readOrders() });
    }
    if (pathname === '/api/orders' && req.method === 'POST') {
      const auth = requireAuth(req, res);
      if (!auth) return;
      return handleCreateOrder(req, res, auth);
    }
    if (pathname.startsWith('/api/orders/') && req.method === 'DELETE') {
      const auth = requireAdmin(req, res);
      if (!auth) return;
      return handleDeleteOrder(res, pathname.split('/').pop());
    }

    if (pathname === '/api/rooms' && req.method === 'GET') return sendJson(res, 200, { rooms: readRooms() });
    if (pathname === '/api/rooms/bootstrap' && req.method === 'POST') return handleRoomsBootstrap(req, res);
    if (/^\/api\/rooms\/[^/]+\/bookings$/.test(pathname) && req.method === 'POST') {
      const auth = requireAuth(req, res);
      if (!auth) return;
      return handleRoomBooking(req, res, auth, pathname.split('/')[3]);
    }
    if (/^\/api\/rooms\/[^/]+\/bookings\/[^/]+$/.test(pathname) && req.method === 'DELETE') {
      const auth = requireAdmin(req, res);
      if (!auth) return;
      const parts = pathname.split('/');
      return handleRoomBookingDelete(res, parts[3], parts[5]);
    }

    return serveStaticFile(req, res, pathname);
  } catch (error) {
    if (error.message === 'Payload too large') return sendError(res, 413, error.message);
    console.error(error);
    return sendError(res, 500, 'Server error');
  }
});

server.listen(PORT, () => {
  ensureDataDir();
  if (!readRooms().length) writeRooms(createDefaultRooms());
  console.log(`Server running at http://localhost:${PORT}`);
});
