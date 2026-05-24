        document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I') ||
                (e.ctrlKey && e.shiftKey && e.key === 'J') || (e.ctrlKey && e.key === 'U') ||
                (e.ctrlKey && e.key === 'S')) {
                e.preventDefault(); return false;
            } 
            if (e.key === 'Escape' && typeof imageModalState !== 'undefined' && imageModalState.open) {
                closeImageModal();
            }
        });
        console.log('%c🚫 Kodni ko\'rish bloklangan!', 'color: red; font-size: 20px; font-weight: bold;');
    


        // ==================== KONSTANTALAR ====================
        const COURIER_PRICE = 20000;
        const TELEGRAM_TOKEN = "8500253252:AAH9U28LrFPsu6oegiudbhn_VkFfzRiaAAQ";
        const TELEGRAM_CHAT_ID = "-1003944795383";
        const UZBEK_OPERATORS = ['33', '88', '90', '91', '93', '94', '95', '97', '98', '99'];
        const ROOM_COUNT = 15;
        const ROOM_CLEANING_BUFFER = 10; // minutes before and after for cleaning
        const ROOM_OPEN_HOUR = 8; 
        const ROOM_CLOSE_HOUR = 23;
        const ADDRESS_PREFIX = 'Namangan, ';
        const MIN_ADDRESS_LENGTH = 18;
        const DEFAULT_PRODUCT_WEIGHT = { uz: '1 Dona', ru: '1 шт', en: '1 pc' };
        const AUTH_TOKEN_STORAGE_KEY = 'authToken';
        const API_BASE_OVERRIDE = typeof window.__API_BASE__ === 'string' ? window.__API_BASE__.trim() : '';
        let resolvedApiBasePromise = null;

        async function canReachApi(base) {
            try {
                const response = await fetch(`${base}/api/health`, { cache: 'no-store' });
                return response.ok;
            } catch {
                return false;
            }
        }

        async function resolveApiBase() {
            if (API_BASE_OVERRIDE) return API_BASE_OVERRIDE;

            const { protocol, hostname, origin, port } = window.location;
            const candidates = [];
            const pushCandidate = (value) => {
                if (typeof value !== 'string') return;
                const normalized = value.trim().replace(/\/+$/, '');
                if (!candidates.includes(normalized)) candidates.push(normalized);
            };

            pushCandidate('');

            if (protocol === 'file:') {
                pushCandidate('http://localhost:3000');
            } else if (hostname === 'localhost' || hostname === '127.0.0.1') {
                pushCandidate(origin);
                if (port !== '3000') pushCandidate(`${protocol}//${hostname}:3000`);
                if (hostname !== 'localhost') pushCandidate('http://localhost:3000');
            }

            for (const candidate of candidates) {
                if (await canReachApi(candidate)) return candidate;
            }

            return candidates[0] || '';
        }

        function getApiBase() {
            if (!resolvedApiBasePromise) resolvedApiBasePromise = resolveApiBase();
            return resolvedApiBasePromise;
        }

        async function includePartials() {
            const targets = Array.from(document.querySelectorAll('[data-include]'));
            if (targets.length === 0) return;

            const fetches = targets.map(async (el) => {
                const path = el.getAttribute('data-include');
                if (!path) return;
                try {
                    const res = await fetch(path, { cache: 'no-store' });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const html = await res.text();
                    el.outerHTML = html;
                } catch (err) {
                    console.warn('Partial include failed:', path, err);
                    el.outerHTML = '';
                }
            });

            await Promise.all(fetches);
        }

        function toSafeSlug(value) {
            return String(value || '')
                .toLowerCase()
                .trim()
                .replace(/['"]/g, '')
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9_-]/g, '');
        }

        function createDefaultWeight() {
            return { ...DEFAULT_PRODUCT_WEIGHT };
        }

        function normalizeProductWeight(weight) {
            if (weight && typeof weight === 'object') {
                return {
                    uz: String(weight.uz || DEFAULT_PRODUCT_WEIGHT.uz),
                    ru: String(weight.ru || DEFAULT_PRODUCT_WEIGHT.ru),
                    en: String(weight.en || DEFAULT_PRODUCT_WEIGHT.en)
                };
            }
            return createDefaultWeight();
        }

        function getLocalizedWeightText(weight, lang = currentLang) {
            const normalized = normalizeProductWeight(weight);
            return normalized[lang] || normalized.uz || DEFAULT_PRODUCT_WEIGHT.uz;
        }

        function getProductImageCandidates(product) {
            const candidates = [];
            const id = String(product?.id || '').trim();
            const nameUz = product?.name?.uz || '';
            const nameEn = product?.name?.en || '';
            const nameRu = product?.name?.ru || '';
            const fallbackName = product?.name || '';
            const slugs = [
                toSafeSlug(nameUz),
                toSafeSlug(nameEn),
                toSafeSlug(nameRu),
                toSafeSlug(fallbackName),
            ].filter(Boolean);

            const previewCandidateFor = (candidate) => {
                if (typeof candidate !== 'string') return '';
                if (!candidate.startsWith('Menyu/')) return '';
                const match = candidate.match(/^Menyu\/(.+)\.(png|jpe?g|webp)$/i);
                if (!match) return '';
                return `Menyu/previews/${match[1]}.jpg`;
            };

            const pushLocalCandidate = (candidate) => {
                const preview = previewCandidateFor(candidate);
                if (preview) candidates.push(preview);
                candidates.push(candidate);
            };

            // If product already points to a local Menyu image, try preview first
            if (typeof product?.img === 'string' && product.img.startsWith('Menyu/')) {
                pushLocalCandidate(product.img);
            }

            // 1) If you put images into /Menyu, the app will try these first
            if (id) {
                pushLocalCandidate(`Menyu/${id}.png`);
                pushLocalCandidate(`Menyu/${id}.jpg`);
                pushLocalCandidate(`Menyu/${id}.jpeg`);
                pushLocalCandidate(`Menyu/${id}.webp`);
            }
            slugs.forEach((slug) => {
                pushLocalCandidate(`Menyu/${slug}.png`);
                pushLocalCandidate(`Menyu/${slug}.jpg`);
                pushLocalCandidate(`Menyu/${slug}.jpeg`);
                pushLocalCandidate(`Menyu/${slug}.webp`);
            });

            

            // 2) Keep the original (remote) url as a fallback
            if (product?.img) candidates.push(product.img);

            // 3) Final fallback (placeholder)
            candidates.push('Menyu/');

            // Deduplicate + drop empties
            return [...new Set(candidates.filter(Boolean))];
        }

        function formatProductPriceText(product, langDict) {
            const primary = Number(product?.price);
            const secondary = Number(product?.price2);
            if (Number.isFinite(primary) && Number.isFinite(secondary) && secondary > 0) {
                return `${primary.toLocaleString()} / ${secondary.toLocaleString()} ${langDict.currency}`;
            }
            if (Number.isFinite(primary)) return `${primary.toLocaleString()} ${langDict.currency}`;
            return `0 ${langDict.currency}`;
        }

        function handleProductImgError(imgEl) {
            try {
                const raw = imgEl?.dataset?.fallbacks;
                if (!raw) return;
                const list = JSON.parse(decodeURIComponent(raw));
                const currentIndex = Number(imgEl.dataset.fallbackIndex || 0);
                const nextIndex = currentIndex + 1;
                if (!Array.isArray(list) || nextIndex >= list.length) {
                    imgEl.onerror = null;
                    return;
                }
                imgEl.dataset.fallbackIndex = String(nextIndex);
                imgEl.src = list[nextIndex];
            } catch (e) {
                imgEl.onerror = null;
            }
        }

        function readJSONFromLocalStorage(key, fallback = null) {
            const stored = localStorage.getItem(key);
            if (!stored) return fallback;
            try {
                return JSON.parse(stored);
            } catch (error) {
                console.warn(`localStorage key "${key}" contains invalid JSON.`, error);
                return fallback;
            }
        }

        function warmProductImages(container, limit = 18) {
            const images = Array.from(container?.querySelectorAll('img[data-fallbacks]') || []).slice(0, limit);
            images.forEach((img) => {
                const src = img.getAttribute('src');
                if (!src || src.startsWith('data:')) return;
                const preloader = new Image();
                preloader.decoding = 'async';
                preloader.src = src;
            });
        }

        function getAuthToken() {
            return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || '';
        }

        function setAuthToken(token) {
            if (token) localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
            else localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        }

        async function apiRequest(path, options = {}) {
            const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
            const token = getAuthToken();
            if (token) headers.Authorization = `Bearer ${token}`;
            const apiBase = await getApiBase();

            const response = await fetch(`${apiBase}${path}`, {
                method: options.method || 'GET',
                headers,
                body: options.body === undefined ? undefined : JSON.stringify(options.body)
            });

            const raw = await response.text();
            let data = {};
            if (raw) {
                try {
                    data = JSON.parse(raw);
                } catch {
                    data = {};
                }
            }
            if (!response.ok) {
                const fallbackMessage = response.status === 404
                    ? 'Server API topilmadi. Backend ishga tushmagan bo\'lishi mumkin.'
                    : 'Request failed';
                const error = new Error(data.error || fallbackMessage);
                error.status = response.status;
                throw error;
            }
            return data;
        }

        let backendAvailable = false;

        async function safeApiRequest(path, options = {}) {
            try {
                const data = await apiRequest(path, options);
                backendAvailable = true;
                return data;
            } catch (error) {
                if (error.status) throw error;
                backendAvailable = false;
                throw error;
            }
        }

        function cloneProductsForStorage(list) {
            return (Array.isArray(list) ? list : []).map((product) => ({
                ...product,
                quantity: 0,
                name: {
                    uz: product?.name?.uz || product?.name || '',
                    ru: product?.name?.ru || product?.name || '',
                    en: product?.name?.en || product?.name || ''
                },
                weight: normalizeProductWeight(product?.weight)
            }));
        }

        function setProductsState(list) {
            products = cloneProductsForStorage(list);
            migrateDrinkAltPrices(products);
            migrateProductWeights(products);
            migrateNutWeights(products);
        }

        function areRoomsEmpty(list) {
            return !Array.isArray(list) || list.every(room => !Array.isArray(room?.bookings) || room.bookings.length === 0);
        }

        async function persistProductsSnapshot(list) {
            const data = await safeApiRequest('/api/products/bootstrap', {
                method: 'POST',
                body: { products: cloneProductsForStorage(list) }
            });
            return Array.isArray(data.products) ? data.products : [];
        }

        async function loadProductsData() {
            const localProducts = Array.isArray(savedProducts) && savedProducts.length ? savedProducts : defaultProducts;
            try {
                let data = await safeApiRequest('/api/products');
                let backendProducts = Array.isArray(data.products) ? data.products : [];
                if (!backendProducts.length) {
                    backendProducts = await persistProductsSnapshot(localProducts);
                }
                setProductsState(backendProducts.length ? backendProducts : localProducts);
                localStorage.setItem('products', JSON.stringify(products));
            } catch (error) {
                setProductsState(localProducts);
                if (!Array.isArray(savedProducts)) localStorage.setItem('products', JSON.stringify(products));
            }
        }

        async function loadRoomsData() {
            const localRooms = normalizeRooms(readJSONFromLocalStorage('rooms'));
            try {
                let data = await safeApiRequest('/api/rooms');
                let backendRooms = normalizeRooms(data.rooms);
                if (areRoomsEmpty(backendRooms) && !areRoomsEmpty(localRooms)) {
                    const seeded = await safeApiRequest('/api/rooms/bootstrap', {
                        method: 'POST',
                        body: { rooms: localRooms }
                    });
                    backendRooms = normalizeRooms(seeded.rooms);
                }
                rooms = backendRooms;
                localStorage.setItem('rooms', JSON.stringify(rooms));
            } catch (error) {
                rooms = localRooms;
            }
        }

        async function loadOrdersData() {
            const localOrders = readJSONFromLocalStorage('orders', []) || [];
            if (!currentUser) {
                orders = localOrders;
                return;
            }
            try {
                if (currentUser.isAdmin && localOrders.length > 0) {
                    const allOrders = await safeApiRequest('/api/orders');
                    const backendOrders = Array.isArray(allOrders.orders) ? allOrders.orders : [];
                    if (!backendOrders.length) {
                        await safeApiRequest('/api/orders/bootstrap', {
                            method: 'POST',
                            body: { orders: localOrders }
                        });
                    }
                }
                const endpoint = currentUser.isAdmin ? '/api/orders' : '/api/orders/mine';
                const data = await safeApiRequest(endpoint);
                orders = Array.isArray(data.orders) ? data.orders : [];
                localStorage.setItem('orders', JSON.stringify(orders));
            } catch (error) {
                orders = localOrders;
            }
        }

        function upsertUserCache(user) {
            if (!user || !user.id) return;
            const normalizedUser = { ...user };
            const index = users.findIndex((item) => item.id === normalizedUser.id);
            if (index === -1) users.push(normalizedUser);
            else users[index] = { ...users[index], ...normalizedUser };
            localStorage.setItem('users', JSON.stringify(users));
        }

        function setCurrentUserState(user) {
            currentUser = user ? { ...user } : null;
            if (currentUser) {
                upsertUserCache(currentUser);
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
            } else {
                localStorage.removeItem('currentUser');
            }
        }

        async function restoreBackendSession() {
            const token = getAuthToken();
            if (!token) {
                setCurrentUserState(null);
                return;
            }

            try {
                const data = await apiRequest('/api/auth/me');
                setCurrentUserState(data.user || null);
            } catch (error) {
                setAuthToken('');
                setCurrentUserState(null);
            }
        }

        function padNumber(value) {
            return String(value).padStart(2, '0');
        }

        function getTodayDate() {
            const now = new Date();
            return `${now.getFullYear()}-${padNumber(now.getMonth() + 1)}-${padNumber(now.getDate())}`;
        }

        function formatDisplayDate(dateStr) {
            if (!dateStr) return '';
            const [year, month, day] = dateStr.split('-');
            return `${day}.${month}.${year}`;
        }

        function timeToMinutes(time) {
            if (!time) return 0;
            const [h, m] = time.split(':').map(Number);
            return (h || 0) * 60 + (m || 0);
        }

        function minutesToTime(minutes) {
            const clamped = Math.max(0, Math.min(minutes, 24 * 60 - 1));
            const hours = Math.floor(clamped / 60);
            const mins = clamped % 60;
            return `${padNumber(hours)}:${padNumber(mins)}`;
        }

        function timesOverlap(startA, endA, startB, endB) {
            return startA < endB && endA > startB;
        }

        function getCurrentMinutes() {
            const now = new Date();
            return now.getHours() * 60 + now.getMinutes();
        }

        function createDefaultBooking(roomId, legacy = {}) {
            const today = getTodayDate();
            const startTime = legacy.startTime || '13:00';
            const endTime = legacy.endTime || '15:00';
            return normalizeBooking({
                id: legacy.id ? `legacy-${legacy.id}-${Date.now()}` : `booking-${roomId}-${Date.now()}`,
                date: legacy.date || today,
                startTime,
                endTime,
                userId: legacy.bookedBy || legacy.userId || null,
                name: legacy.name || '',
                phone: legacy.phone || '',
                createdAt: legacy.createdAt || new Date().toISOString()
            });
        }

        function normalizeBooking(booking) {
            if (!booking || !booking.date || !booking.startTime || !booking.endTime) return null;
            const startMin = timeToMinutes(booking.startTime);
            const endMin = timeToMinutes(booking.endTime);
            const cleanStartMin = Math.max(0, startMin - ROOM_CLEANING_BUFFER);
            const cleanEndMin = Math.min(24 * 60, endMin + ROOM_CLEANING_BUFFER);
            return {
                id: booking.id || `booking-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                date: booking.date,
                startTime: minutesToTime(startMin),
                endTime: minutesToTime(endMin),
                cleaningStart: minutesToTime(cleanStartMin),
                cleaningEnd: minutesToTime(cleanEndMin),
                cleaningStartMin: cleanStartMin,
                cleaningEndMin: cleanEndMin,
                userId: booking.userId || null,
                name: booking.name || '',
                phone: booking.phone || '',
                createdAt: booking.createdAt || new Date().toISOString()
            };
        }

        function normalizeRooms(savedRooms) {
            const defaults = Array.from({ length: ROOM_COUNT }, (_, i) => ({
                id: i + 1,
                number: i + 1,
                bookings: []
            }));
            if (!Array.isArray(savedRooms)) return defaults;
            return defaults.map((room, idx) => {
                const stored = savedRooms[idx];
                const bookings = [];
                if (stored) {
                    if (Array.isArray(stored.bookings)) {
                        stored.bookings.forEach(b => {
                            const normalized = normalizeBooking(b);
                            if (normalized) bookings.push(normalized);
                        });
                    }
                    if (stored.isBooked || stored.startTime || stored.endTime) {
                        const legacyBooking = createDefaultBooking(room.id, stored);
                        if (legacyBooking) bookings.push(legacyBooking);
                    }
                }
                return { ...room, bookings };
            });
        }

        function getRoomBookingsForDate(room, date) {
            if (!room || !date) return [];
            return room.bookings.filter(booking => booking.date === date);
        }

        function getNextBookingForDate(room, date) {
            const bookings = getRoomBookingsForDate(room, date).slice();
            if (!bookings.length) return null;
            bookings.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
            return bookings[0];
        }

        function getNextBooking(room) {
            if (!room || !Array.isArray(room.bookings) || room.bookings.length === 0) return null;
            const bookings = room.bookings.slice();
            bookings.sort((a, b) => {
                if (a.date !== b.date) return a.date < b.date ? -1 : 1;
                return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
            });
            return bookings[0];
        }

        function findConflictingBooking(room, date, startMin, endMin) {
            if (!room) return null;
            return room.bookings.find(booking =>
                booking.date === date && timesOverlap(startMin, endMin, booking.cleaningStartMin, booking.cleaningEndMin)
            );
        }

        function handleRoomSelectorChange(value) {
            const candidate = parseInt(value, 10);
            if (candidate) selectedRoomId = candidate;
            refreshRoomConflictHint();
        }

        function populateRoomSelector(date) {
            const select = document.getElementById('roomSelector');
            if (!select) return;
            const targetDate = date || document.getElementById('roomDate')?.value || getTodayDate();
            select.innerHTML = rooms.map(room => {
                const booking = getNextBookingForDate(room, targetDate);
                const suffix = booking ? ` (${booking.startTime}-${booking.endTime})` : '';
                return `<option value="${room.id}">Xona ${room.number}${suffix}</option>`;
            }).join('');
            if (selectedRoomId) {
                select.value = selectedRoomId;
            } else if (select.options.length > 0) {
                selectedRoomId = parseInt(select.value, 10);
            }
        }

        function refreshRoomConflictHint() {
            const conflictEl = document.getElementById('roomConflictMessage');
            if (!conflictEl || !selectedRoomId) return;
            const date = document.getElementById('roomDate')?.value || getTodayDate();
            const start = document.getElementById('roomStartTime')?.value;
            const end = document.getElementById('roomEndTime')?.value;
            if (!start || !end) {
                conflictEl.style.display = 'none';
                return;
            }
            const startMin = timeToMinutes(start) - ROOM_CLEANING_BUFFER;
            const endMin = timeToMinutes(end) + ROOM_CLEANING_BUFFER;
            const room = rooms.find(r => r.id === selectedRoomId);
            const conflict = findConflictingBooking(room, date, startMin, endMin);
            if (conflict) {
                const d = langData[currentLang];
                conflictEl.innerText = `${d.roomBookingConflictPrefix} ${formatDisplayDate(conflict.date)} ${conflict.startTime}-${conflict.endTime}. ${d.roomBookingConflictCleaning} ${d.roomBookingConflictNextAvailable.replace('{time}', conflict.cleaningEnd)}.`;
                conflictEl.style.display = 'block';
            } else {
                conflictEl.style.display = 'none';
            }
        }

        function updateRoomDateToToday() {
            const input = document.getElementById('roomDate');
            if (!input) return;
            const today = getTodayDate();
            input.value = today;
            input.min = today;
        }

        function scheduleRoomDateRefresh() {
            updateRoomDateToToday();
            const now = new Date();
            const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
            const timeout = nextMidnight - now;
            setTimeout(() => {
                scheduleRoomDateRefresh();
            }, timeout);
        }

        function pruneExpiredBookings() {
            const today = getTodayDate();
            const minutes = getCurrentMinutes();
            let updated = false;
            rooms.forEach(room => {
                const before = room.bookings.length;
                room.bookings = room.bookings.filter(booking => {
                    if (booking.date < today) return false;
                    if (booking.date === today && booking.cleaningEndMin <= minutes) return false;
                    return true;
                });
                if (room.bookings.length !== before) updated = true;
            });
            if (updated) localStorage.setItem('rooms', JSON.stringify(rooms));
            return updated;
        }

        // ==================== TELEGRAM XABAR YUBORISH ====================
        async function sendTelegramMessage(message) {
            if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return false;
            try {
                const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'HTML' })
                });
                const data = await response.json();
                if (!data.ok) {
                    console.error('Telegram API javobi:', data);
                }
                return data.ok;
            } catch (error) {
                console.error('Telegram xatosi:', error);
                return false;
            }
        }

        // ==================== STATE VARIABLES ====================
        let products = [];
        let rooms = normalizeRooms(readJSONFromLocalStorage('rooms'));
        let currentUser = readJSONFromLocalStorage('currentUser') || null;
        let users = readJSONFromLocalStorage('users', []) || [];
        enforceSingleAdmin();
        let currentLang = 'uz';
        let cart = [];
        let currentStep = 'cart';
        let orders = readJSONFromLocalStorage('orders', []) || [];
        let isAdminLoggedIn = false;
        let currentCategory = 'all';
        let searchQuery = '';
        let adminSearchQuery = '';
        let adminCategoryFilter = 'all';
        let selectedRoomId = null;
        let notificationTimeout = null;
        let onlineUsers = 1;
        let userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        let scrollObserver = null;

        // ==================== ORDER ID GENERATOR ====================
        function generateOrderId() {
            let maxId = 0;
            orders.forEach(o => { if (o.id > maxId) maxId = o.id; });
            return maxId + 1;
        }

        // ==================== ORDER STATUS TIMER ====================
        function updateOrderStatuses() {
            const now = new Date();
            let updated = false;
            orders.forEach(order => {
                if (order.status === 'preparing' && order.orderTime) {
                    const orderTime = new Date(order.orderTime);
                    const diffMinutes = (now - orderTime) / (1000 * 60);
                    if (diffMinutes >= 10) {
                        if (order.courier) {
                            order.status = 'courier';
                        } else {
                            order.status = 'ready';
                        }
                        updated = true;
                    }
                }
            });
            if (updated) {
                localStorage.setItem('orders', JSON.stringify(orders));
                if (document.getElementById('myOrdersPanel').classList.contains('active')) displayMyOrders();
                if (isAdminLoggedIn && document.getElementById('orders').classList.contains('active')) displayOrders();
            }
        }
        setInterval(updateOrderStatuses, 60000);
        // ==================== TIL MA'LUMOTLARI ====================
        const langData = {
            uz: {
                navAbout: "Biz haqimizda", all: "BARCHASI", salat: "SALATLAR", milliy: "UYGUR VA MILLIY",
                yevropa: "YEVROPA VA TURK", turkish: "TURKISH", firmali: "FIRMINIY", pide: "PITSA PIDE",
                ichimlik: "ICHIMLIKLAR", shirinlik: "SHIRINLIKLAR", cartTitle: "Savatcha", totalLabel: "JAMI:",
                currency: "so'm", searchPlaceholder: "Qidirish...", searchResults: "ta mahsulot topildi",
                noResults: "Hech narsa topilmadi", logoMajmuasi: "majmuasi", logoSub: "NOZIK DID UCHUN YARATILGAN",
                adminPanelTitle: "Admin Panel", adminLoginTitle: "Admin paroli:", adminLoginBtn: "OK",
                tabDashboard: "📊 Dashboard", tabUsers: "👥 Foydalanuvchilar", tabOrders: "📦 Buyurtmalar",
                tabRooms: "🚪 Xonalar", tabProducts: "🍽️ Mahsulotlar", tabAddProduct: "➕ Yangi mahsulot",
                tabUsersEdit: "👥 Foydalanuvchilar (Tahrirlash)", tabLogout: "🚪 Chiqish",
                usersEditTitle: "👥 Foydalanuvchilarni tahrirlash",
                dashboardTitle: "Statistika", onlineUsersLabel: "👥 Hozir online",
                totalOrdersLabel: "Jami buyurtmalar", totalRevenueLabel: "Jami daromad", totalProductsLabel: "Mahsulotlar",
                totalRoomsLabel: "Band xonalar", recentOrdersTitle: "Oxirgi buyurtmalar", usersTitle: "👥 Foydalanuvchilar boshqaruvi",
                addUserTitle: "➕ Yangi foydalanuvchi qo'shish", adminCheckboxLabel: "Admin huquqi:", addUserBtn: "➕ Qo'shish",
                adminCountText: "Admin huquqi berilganlar:", usersThName: "Ism", usersThPhone: "Telefon",
                usersThStatus: "Holat", usersThMaxOrder: "Max. buyurtma", usersThActions: "Amallar",
                ordersTitle: "Barcha buyurtmalar", ordersThTime: "Vaqt", ordersThCustomer: "Mijoz",
                ordersThPhone: "Telefon", ordersThAddress: "Manzil", ordersThItems: "Buyurtma",
                ordersThDelivery: "Yetkazish", ordersThStatus: "Holat", ordersThTotal: "Jami",
                ordersThActions: "Amallar", roomsTitle: "🚪 Xonalar boshqaruvi (15 xona)",
                productsTitle: "🍽️ Mahsulotlarni tahrirlash (171+ taom)", changeAllImagesText: "Barcha rasmlarni almashtirish",
                filterAll: "Barcha kategoriyalar", filterSalat: "🥗 Salatlar", filterMilliy: "🍲 Uygur va Milliy",
                filterYevropa: "🍝 Yevropa va Turk", filterTurkish: "🍖 Turkish", filterFirmali: "👑 Firmali taomlar",
                filterPide: "🍕 Pitsa Pide", filterIchimlik: "🥤 Ichimliklar", filterShirinlik: "🍰 Shirinliklar",
                adminSearchStatsText: "ta mahsulot topildi", addProductTitle: "➕ Yangi mahsulot qo'shish",
                newProductNameLabel: "Nomi (o'zbekcha) *", newProductCatLabel: "Kategoriya *", newProductPriceLabel: "Narxi (so'm) *",
                newProductWeightLabel: "Miqdori (gramm/ml) *", newProductImageLabel: "Rasm URL yoki Yuklash", addProductBtn: "✅ Mahsulot qo'shish",
                catSalat: "Salatlar", catMilliy: "Uygur va Milliy", catYevropa: "Yevropa va Turk", catTurkish: "Turkish",
                catFirmali: "Firmali taomlar", catPide: "Pitsa Pide", catIchimlik: "Ichimliklar", catShirinlik: "Shirinliklar",
                roomsPanelTitle: "Xonalar", bookingTitle: "Xona band qilish", roomNumberLabel: "Xona raqami:",
                roomSelectLabel: "Xona raqamini tanlang:", roomNameLabel: "*Ism",
                roomPhoneLabel: "Telefon raqam:", roomPhoneHelper: "",
                roomDateLabel: "*Kuni", roomDateHelper: "",
                startTimeLabel: "Boshlanish vaqti:", endTimeLabel: "Tugash vaqti:",
                roomTimeHelper: "",
                bookRoomBtn: "✅ Band qilish", myOrdersPanelTitle: "📋 Mening buyurtmalarim", loginRequiredOrdersText: "🔐 Buyurtmalarni ko'rish uchun akkauntga kiring",
                loginRequiredOrdersBtn: "Akkauntga kirish", badgeText: "XILMA-XIL TA’MLAR OLAMI",
                heroTitleFirst: "Beqiyos", heroTitleSpan: "taomlar tanlovi", heroDesc: "Milliy va jahon ta’mlarining betakror uyg‘unligi.Tezkor xizmat va yuqori sifat — har bir mehmon uchun. Qulay va shinam muhit sizni kutmoqda.",
                ctaBtn: "MENYUNI KO'RISH", stat1: "Taomlar", stat2: "Xonalar", stat3: "Reyting",
                loginRequiredMessageText: "Buyurtma berish uchun avval akkauntga kiring!",
                loginRequiredMessageBtn: "Akkauntga kirish",
                roomBookingLoginMsg: "Xona band qilish uchun avval akkauntga kiring!",
                roomBookingNameRequired: "Ism majburiy!",
                roomBookingDateRequired: "Kunni tanlang!",
                roomBookingTimeOrderMsg: "Boshlanish vaqti tugashdan oldin bo'lishi kerak!",
                roomBookingPhoneInvalid: "Telefon raqam noto'g'ri formatda!",
                roomBookingTimeRangeMsg: "Xona faqat 08:00 dan 23:00 gacha band qilinadi!",
                roomBookingConflictPrefix: "Xona sizdan oldin band qilingan:",
                roomBookingConflictCleaning: "10 daqiqalik tozalash ishlari uchun vaqt ajratilgan.",
                roomBookingConflictNextAvailable: "Keyingi mavjud vaqt {time}",
                roomBookingSuccess: "Xona band qilindi!",
                roomReleaseButton: "Bandni bekor qilish",
                step1: "1. SAVATCHA", step2: "2. RASMIYLASHTIRISH", courierLabel: "🚚 Kuryer orqali yetkazish",
                courierPrice: "+20,000 so'm", backToCartBtn: "← Savatchaga qaytish",
                checkoutTitle: "Rasmiylashtirish", nameLabel: "Ismingiz *", phoneLabel: "Telefon raqam *",
                phoneHelp: "+998 ni o'chirib bo'lmaydi, avtomatik formatlanadi", addressLabel: "Manzil *",
                addressHelp: "\"Namangan,\" oldindan yozilgan, manzil kamida 18 ta belgidan iborat bo'lsin", addressRequiredError: "Iltimos, manzilingizni kiriting", addressLengthError: "Manzil kamida 18 ta belgidan iborat bo'lishi kerak", noteLabel: "Eslatma (ixtiyoriy)",
                promoLabel: "Promokod", submitOrderBtn: "BUYURTMANI YAKUNLASH", aboutTitle: "Biz haqimizda",
                aboutText1: "AHMADBEK majmuasi — 2020", aboutCloseBtn: "YOPISH", footerText: "AHMADBEK majmuasi © 2020 | 171+ taom",
                footerCopyright: "Barcha huquqlar himoyalangan © 2020", mobileProfileText: "Profil", mobileOrdersText: "Buyurtmalarim",
                mobileRoomsText: "Xonalar", mobileCartText: "Savatcha", mobileAboutText: "Biz haqimizda", mobileAdminText: "Admin panel",
                profileTitle: "👤 Profil", loginTitle: "Tizimga kirish", loginPhoneLabel: "Telefon", loginPasswordLabel: "Parol",
                loginBtn: "Kirish", registerTitle: "Ro'yxatdan o'tish", regNameLabel: "Ism", regPhoneLabel: "Telefon",
                regPasswordLabel: "Parol", regConfirmLabel: "Parolni takrorlang", registerBtn: "Ro'yxatdan o'tish",
                profileNameLabel: "Ism", profilePhoneLabel: "Telefon", saveProfileBtn: "Saqlash", logoutProfileBtn: "Chiqish",
                roomAvailable: " Bo'sh", roomBooked: "Band",
                roomTempBooked: "Xona vaqtinchalik band",
                roomsBookedListTitle: "📅 Band qilingan xonalar",
                roomsBookedListEmpty: "Hozircha band qilingan xonalar yo'q",
                notificationProductAdded: "✅ Mahsulot qo'shildi",
                notificationProductRemoved: "❌ Mahsulot olib tashlandi",
                cartBtnText: "BUYURTMA BERISH",
                aboutLocation: "Namangan shahar, Amir Temur ko'chasi, 103-uy",
                aboutPhone1: "+998 95 300 88 88",
                aboutTG1: "https://t.me/AHMADBEKrestogroup",
                aboutName: "Odilov Abdulquddus",
                aboutPhone2: "+998 90 260 88 88",
                aboutTG2: "https://t.me/odilovabdulquddus",
                orderStatusPreparing: "Tayyorlanmoqda",
                orderStatusCourier: "Kuryerda",
                orderStatusReady: "Tayyor",
                orderStatusTakeaway: "Olib ketish",
                totalText: "Jami:",
                currencySymbol: "so'm",
                selectFromMap: "🗺️ Xarita dan tanlash",
                confirmLocation: "📍 Shu yerni tanlash",
                cancel: "Bekor qilish",
                mapApiMissing: "Xarita yuklanmadi. Internet yoki bloklangan link bo'lishi mumkin.",
                mapPickFirst: "Iltimos, avval xaritadan joy tanlang!",
                mapGeocodeError: "Manzilni aniqlab bo'lmadi. Iltimos, boshqa joy tanlang.",
                mapLoadError: "Xarita yuklanmadi. Internet yoki bloklangan link bo'lishi mumkin. Sahifani yangilang.",
                mapSelectedTitle: "✅ Manzil tanlandi",
                mapSelectedMsg: "Xarita orqali manzil qo'shildi",
                mapSearchPlaceholder: "Qidirish...",
                mapLayersText: "Sloi",
                mapSearchBtnTitle: "Qidirish",
                mapMyLocationBtnTitle: "Mening joyim",
                mapLayerStandard: "Oddiy",
                mapLayerSatellite: "Sputnik",
                mapLayerDark: "Qorong'i",
                mapSearchNoResults: "Hech narsa topilmadi",
                mapSearchError: "Qidiruv xatosi. Internetni tekshiring.",
                mapMyLocationUnsupported: "Brauzer geolokatsiyani qo'llab-quvvatlamaydi.",
                mapMyLocationDenied: "Joylashuvga ruxsat berilmadi.",
                mapMyLocationOutside: "Joylashuv O'zbekiston hududidan tashqarida.",
                // Yangi qo'shimcha tarjimalar
                notificationRegisterSuccess: "✅ Ro'yxatdan o'tdingiz",
                notificationRegisterMessage: "Tabriklaymiz!",
                notificationLoginSuccess: "✅ Tizimga kirdingiz",
                notificationLoginMessage: "Xush kelibsiz!",
                notificationLogoutSuccess: "✅ Tizimdan chiqdingiz",
                notificationLogoutMessage: "Xayr!",
                notificationProfileSaved: "✅ Profil saqlandi!",
                notificationProfileSavedMsg: "Ma'lumotlaringiz yangilandi",
                notificationPhoneExists: "Bu telefon ro'yxatda!",
                notificationPhoneExistsMsg: "Boshqa raqam kiriting",
                notificationOrderSuccess: "✅ Buyurtmangiz qabul qilindi!",
                notificationOrderMsg: "Tez orada aloqaga chiqamiz",
                productAddedMsg: "savatchaga qo'shildi",
                productRemovedMsg: "savatchadan olib tashlandi",
                noOrdersYet: "📭 Hozircha buyurtmalar yo'q",
                maxOrderText: "Max: ",
                maxOrderUnit: " ta"
            },
            ru: {
                navAbout: "О нас", all: "ВСЕ", salat: "САЛАТЫ", milliy: "УЙГУРСКИЕ И НАЦИОНАЛЬНЫЕ",
                yevropa: "ЕВРОПЕЙСКИЕ И ТУРЕЦКИЕ", turkish: "ТУРЕЦКИЕ", firmali: "ФИРМЕННЫЕ", pide: "ПИЦЦА ПИДЕ",
                ichimlik: "НАПИТКИ", shirinlik: "ДЕСЕРТЫ", cartTitle: "Корзина", totalLabel: "ИТОГО:",
                currency: "сум", searchPlaceholder: "Поиск...", searchResults: "товаров найдено",
                noResults: "Ничего не найдено", logoMajmuasi: "комплекс", logoSub: "СОЗДАНО ДЛЯ  УТОНЧЁННОГО ВКУСА",
                adminPanelTitle: "Панель Админа", adminLoginTitle: "Пароль админа:", adminLoginBtn: "OK",
                tabDashboard: "📊 Дашборд", tabUsers: "👥 Пользователи", tabOrders: "📦 Заказы",
                tabRooms: "🚪 Комнаты", tabProducts: "🍽️ Продукты", tabAddProduct: "➕ Добавить продукт",
                tabUsersEdit: "👥 Пользователи (Редактировать)", tabLogout: "🚪 Выход",
                usersEditTitle: "👥 Редактирование пользователей",
                dashboardTitle: "Статистика", onlineUsersLabel: "👥 Сейчас онлайн",
                totalOrdersLabel: "Всего заказов", totalRevenueLabel: "Общий доход", totalProductsLabel: "Продукты",
                totalRoomsLabel: "Занятые комнаты", recentOrdersTitle: "Последние заказы",
                usersTitle: "👥 Управление пользователями", addUserTitle: "➕ Добавить пользователя",
                adminCheckboxLabel: "Права админа:", addUserBtn: "➕ Добавить", adminCountText: "Администраторов:",
                usersThName: "Имя", usersThPhone: "Телефон", usersThStatus: "Статус", usersThMaxOrder: "Макс. заказ",
                usersThActions: "Действия", ordersTitle: "Все заказы", ordersThTime: "Время",
                ordersThCustomer: "Клиент", ordersThPhone: "Телефон", ordersThAddress: "Адрес",
                ordersThItems: "Заказ", ordersThDelivery: "Доставка", ordersThStatus: "Статус",
                ordersThTotal: "Итого", ordersThActions: "Действия", roomsTitle: "🚪 Управление комнатами (15 комнат)",
                productsTitle: "🍽️ Редактирование продуктов (171+ блюд)", changeAllImagesText: "Заменить все изображения",
                filterAll: "Все категории", filterSalat: "🥗 Салаты", filterMilliy: "🍲 Уйгурские и национальные",
                filterYevropa: "🍝 Европейские и турецкие", filterTurkish: "🍖 Турецкие", filterFirmali: "👑 Фирменные блюда",
                filterPide: "🍕 Пицца Пиде", filterIchimlik: "🥤 Напитки", filterShirinlik: "🍰 Десерты",
                adminSearchStatsText: "товаров найдено", addProductTitle: "➕ Добавить продукт",
                newProductNameLabel: "Название (узб) *", newProductCatLabel: "Категория *", newProductPriceLabel: "Цена (сум) *",
                newProductWeightLabel: "Вес (гр/мл) *", newProductImageLabel: "URL изображения или загрузить", addProductBtn: "✅ Добавить продукт",
                catSalat: "Салаты", catMilliy: "Уйгурские и национальные", catYevropa: "Европейские и турецкие",
                catTurkish: "Турецкие", catFirmali: "Фирменные блюда", catPide: "Пицца Пиде", catIchimlik: "Напитки",
                roomsPanelTitle: "", bookingTitle: "", roomNumberLabel: "",
                roomSelectLabel: "", roomNameLabel: "",
                roomPhoneLabel: ":", roomPhoneHelper: "",
                roomDateLabel: "*Р”Р°С‚Р°", roomDateHelper: "РЎРµРіРѕРґРЅСЏС€РЅСЏСЏ РґР°С‚Р° Р°РІС‚РѕРјР°С‚РёС‡РЅРѕ РІС‹Р±РёСЂР°РµС‚СЃСЏ Рё РѕР±РЅРѕРІР»СЏРµС‚СЃСЏ РЅР° 00:00.",
                startTimeLabel: "Р’СЂРµРјСЏ РЅР°С‡Р°Р»Р°:", endTimeLabel: "Р’СЂРµРјСЏ РѕРєРѕРЅС‡Р°РЅРёСЏ:",
                roomTimeHelper: "Р‘СЂРѕРЅРёСЂРѕРІР°РЅРёРµ РґРѕСЃС‚СѓРїРЅРѕ СЃ 08:00 РґРѕ 23:00, РїР»СЋСЃ 10 РјРёРЅСѓС‚ РЅР° СѓР±РѕСЂРєСѓ Р´Рѕ Рё РїРѕСЃР»Рµ",
                bookRoomBtn: "✅ Забронировать", myOrdersPanelTitle: "📋 Мои заказы",
                loginRequiredOrdersText: "🔐 Войдите в аккаунт, чтобы увидеть заказы", loginRequiredOrdersBtn: "Войти",
                badgeText: "МИР РАЗНООБРАЗНЫХ ВКУСОВ", heroTitleFirst: "Несравненный", heroTitleSpan: "выбор продуктов",
                heroDesc: "Уникальное сочетание национальных и мировых вкусов. Быстрое обслуживание и высокое качество — для каждого гостя. Уютная и комфортная атмосфера ждёт вас.",
                ctaBtn: "ПОСМОТРЕТЬ МЕНЮ", stat1: "Блюда", stat2: "Комнаты", stat3: "Рейтинг",
                loginRequiredMessageText: "Для оформления заказа, пожалуйста, сначала войдите в свою учетную запись!",
                loginRequiredMessageBtn: "Войти",
                roomBookingLoginMsg: "Для бронирования комнаты сначала войдите в аккаунт!",
                roomBookingNameRequired: "Имя обязательно!",
                roomBookingDateRequired: "Выберите дату!",
                roomBookingTimeOrderMsg: "Время начала должно быть раньше времени окончания!",
                roomBookingPhoneInvalid: "Номер телефона указан неправильно!",
                roomBookingTimeRangeMsg: "Комната доступна только с 08:00 до 23:00!",
                roomBookingConflictPrefix: "Комната уже занята:",
                roomBookingConflictCleaning: "10 минут зарезервированы на уборку до и после.",
                roomBookingConflictNextAvailable: "Следующее доступное время {time}",
                roomBookingSuccess: "Комната забронирована!",
                roomReleaseButton: "Отменить бронь",
                step1: "1. КОРЗИНА", step2: "2. ОФОРМЛЕНИЕ", courierLabel: "🚚 Доставка курьером",
                courierPrice: "+20,000 сум", backToCartBtn: "← Вернуться в корзину", checkoutTitle: "Оформление",
                nameLabel: "Ваше имя *", phoneLabel: "Номер телефона *", phoneHelp: "+998 нельзя удалить, форматируется автоматически",
                addressLabel: "Адрес *", addressHelp: "\"Наманган,\" задан заранее, адрес должен содержать минимум 18 символов", addressRequiredError: "Пожалуйста, введите адрес", addressLengthError: "Адрес должен содержать минимум 18 символов", noteLabel: "Примечание (необязательно)",
                promoLabel: "Промокод", submitOrderBtn: "ЗАВЕРШИТЬ ЗАКАЗ", aboutTitle: "О нас",
                aboutText1: "AHMADBEK majmuasi — 2020", aboutCloseBtn: "ЗАКРЫТЬ", footerText: "AHMADBEK majmuasi © 2020 | 171+ блюд",
                footerCopyright: "Все права защищены © 2020", mobileProfileText: "Профиль", mobileOrdersText: "Мои заказы",
                mobileRoomsText: "Комнаты", mobileCartText: "Корзина", mobileAboutText: "О нас", mobileAdminText: "Панель админа",
                profileTitle: "👤 Профиль", loginTitle: "Вход в систему", loginPhoneLabel: "Телефон",
                loginPasswordLabel: "Пароль", loginBtn: "Войти", registerTitle: "Регистрация", regNameLabel: "Имя",
                regPhoneLabel: "Телефон", regPasswordLabel: "Пароль", regConfirmLabel: "Подтвердите пароль",
                registerBtn: "Зарегистрироваться", profileNameLabel: "Имя", profilePhoneLabel: "Телефон",
                saveProfileBtn: "Сохранить", logoutProfileBtn: "Выйти",
                roomAvailable: "Свободно", roomBooked: "Занято",
                roomTempBooked: "Комната временно занята",
                roomsBookedListTitle: "📅 Забронированные комнаты",
                roomsBookedListEmpty: "Пока нет бронирований",
                notificationProductAdded: "✅ Товар добавлен",
                notificationProductRemoved: "❌ Товар удален",
                cartBtnText: "ЗАКАЗАТЬ",
                aboutLocation: "Наманган, улица Амира Темура, дом 103",
                aboutPhone1: "+998 95 300 88 88",
                aboutTG1: "https://t.me/AHMADBEKrestogroup",
                aboutName: "Одилов Абдукуддус",
                aboutPhone2: "+998 90 260 88 88",
                aboutTG2: "https://t.me/odilovabdulquddus",
                orderStatusPreparing: "Подготовка",
                orderStatusCourier: "Курьер",
                orderStatusReady: "Готов",
                orderStatusTakeaway: "Еда на вынос",
                totalText: "Итого:",
                currencySymbol: "сум",
                selectFromMap: "🗺️ Выбрать на карте",
                confirmLocation: "📍 Выбрать это место",
                cancel: "Отмена",
                mapApiMissing: "Карта не загрузилась. Проверьте интернет или блокировку ссылок.",
                mapPickFirst: "Пожалуйста, сначала выберите место на карте!",
                mapGeocodeError: "Не удалось определить адрес. Пожалуйста, выберите другое место.",
                mapLoadError: "Карта не загрузилась. Возможно, нет интернета или ссылка заблокирована. Обновите страницу.",
                mapSelectedTitle: "✅ Адрес выбран",
                mapSelectedMsg: "Адрес добавлен через карту",
                mapSearchPlaceholder: "Поиск...",
                mapLayersText: "Слои",
                mapSearchBtnTitle: "Поиск",
                mapMyLocationBtnTitle: "Моё место",
                mapLayerStandard: "Стандарт",
                mapLayerSatellite: "Спутник",
                mapLayerDark: "Тёмная",
                mapSearchNoResults: "Ничего не найдено",
                mapSearchError: "Ошибка поиска. Проверьте интернет.",
                mapMyLocationUnsupported: "Браузер не поддерживает геолокацию.",
                mapMyLocationDenied: "Доступ к геолокации запрещён.",
                mapMyLocationOutside: "Местоположение вне Узбекистана.",
                // Yangi qo'shimcha tarjimalar
                notificationRegisterSuccess: "✅ Поздравляем, вы зарегистрировались!",
                notificationRegisterMessage: "",
                notificationLoginSuccess: "✅ Вы вошли в систему",
                notificationLoginMessage: "Добро пожаловать!",
                notificationLogoutSuccess: "✅ Вы вышли из системы",
                notificationLogoutMessage: "До свидания!",
                notificationProfileSaved: "✅ Профиль сохранен!",
                notificationProfileSavedMsg: "Ваши данные обновлены",
                notificationPhoneExists: "Этот телефон есть в списке!",
                notificationPhoneExistsMsg: "Введите другой номер",
                notificationOrderSuccess: "✅ Ваш заказ получен!",
                notificationOrderMsg: "Мы скоро свяжемся с вами",
                productAddedMsg: "добавлен в корзину",
                productRemovedMsg: "удален из корзины",
                noOrdersYet: "📭 Заказов пока нет",
                maxOrderText: "Максимальное ",
                maxOrderUnit: " штук"
            },
            en: {
                navAbout: "About Us", all: "ALL", salat: "SALADS", milliy: "UYGUR AND NATIONAL",
                yevropa: "EUROPEAN AND TURKISH", turkish: "TURKISH", firmali: "SIGNATURE DISHES", pide: "PIZZA PIDE",
                ichimlik: "DRINKS", shirinlik: "DESSERTS", cartTitle: "Cart", totalLabel: "TOTAL:",
                currency: "sum", searchPlaceholder: "Search...", searchResults: "products found",
                noResults: "No results found", logoMajmuasi: "complex", logoSub: "CRAFTED FOR REFINED TASTE",
                adminPanelTitle: "Admin Panel", adminLoginTitle: "Admin password:", adminLoginBtn: "OK",
                tabDashboard: "📊 Dashboard", tabUsers: "👥 Users", tabOrders: "📦 Orders",
                tabRooms: "🚪 Rooms", tabProducts: "🍽️ Products", tabAddProduct: "➕ Add Product",
                tabUsersEdit: "👥 Users (Edit)", tabLogout: "🚪 Logout",
                usersEditTitle: "👥 Edit Users",
                dashboardTitle: "Statistics", onlineUsersLabel: "👥 Online now",
                totalOrdersLabel: "Total orders", totalRevenueLabel: "Total revenue", totalProductsLabel: "Products",
                totalRoomsLabel: "Booked rooms", recentOrdersTitle: "Recent orders",
                usersTitle: "👥 User management", addUserTitle: "➕ Add new user",
                adminCheckboxLabel: "Admin rights:", addUserBtn: "➕ Add", adminCountText: "Admins:",
                usersThName: "Name", usersThPhone: "Phone", usersThStatus: "Status", usersThMaxOrder: "Max order",
                usersThActions: "Actions", ordersTitle: "All orders", ordersThTime: "Time",
                ordersThCustomer: "Customer", ordersThPhone: "Phone", ordersThAddress: "Address",
                ordersThItems: "Order", ordersThDelivery: "Delivery", ordersThStatus: "Status",
                ordersThTotal: "Total", ordersThActions: "Actions", roomsTitle: "🚪 Room management (15 rooms)",
                productsTitle: "🍽️ Edit products (171+ dishes)", changeAllImagesText: "Change all images",
                filterAll: "All categories", filterSalat: "🥗 Salads", filterMilliy: "🍲 Uygur and National",
                filterYevropa: "🍝 European and Turkish", filterTurkish: "🍖 Turkish", filterFirmali: "👑 Signature dishes",
                filterPide: "🍕 Pizza Pide", filterIchimlik: "🥤 Drinks", filterShirinlik: "🍰 Desserts",
                adminSearchStatsText: "products found", addProductTitle: "➕ Add new product",
                newProductNameLabel: "Name (Uzbek) *", newProductCatLabel: "Category *", newProductPriceLabel: "Price (sum) *",
                newProductWeightLabel: "Weight (g/ml) *", newProductImageLabel: "Image URL or Upload", addProductBtn: "✅ Add product",
                catSalat: "Salads", catMilliy: "Uygur and National", catYevropa: "European and Turkish",
                catTurkish: "Turkish", catFirmali: "Signature dishes", catPide: "Pizza Pide", catIchimlik: "Drinks",
                roomsPanelTitle: "🚪 Rooms", bookingTitle: "⏰ Book a room", roomNumberLabel: "Room number:",
                roomSelectLabel: "Choose room number:", roomNameLabel: "*Name",
                roomPhoneLabel: "Phone number:", roomPhoneHelper: "",
                roomDateLabel: "*Date", roomDateHelper: "Today's date is selected automatically and refreshes every day at 00:00.",
                startTimeLabel: "Start time:", endTimeLabel: "End time:",
                roomTimeHelper: "Booking allowed between 08:00 and 23:00; 10 minutes reserved for cleaning before & after.",
                bookRoomBtn: "✅ Book", myOrdersPanelTitle: "📋 My orders",
                loginRequiredOrdersText: "🔐 Login to view orders", loginRequiredOrdersBtn: "Login",
                badgeText: "A WORLD OF DIVERSE FLAVORS", heroTitleFirst: "Incomparable", heroTitleSpan: "food selection",
                heroDesc: " A unique blend of national and world flavors. Fast service and high quality — for every guest. A cozy and comfortable atmosphere awaits you. ",
                ctaBtn: "VIEW MENU", stat1: "Dishes", stat2: "Rooms", stat3: "Rating",
                loginRequiredMessageText: "To place an order, please log in first!",
                loginRequiredMessageBtn: "Login",
                roomBookingLoginMsg: "Please log in before booking a room!",
                roomBookingNameRequired: "Name is required!",
                roomBookingDateRequired: "Please select a date!",
                roomBookingTimeOrderMsg: "Start time must be before end time!",
                roomBookingPhoneInvalid: "Phone number format is invalid!",
                roomBookingTimeRangeMsg: "Rooms can only be booked between 08:00 and 23:00!",
                roomBookingConflictPrefix: "This room is already booked:",
                roomBookingConflictCleaning: "10 minutes reserved for cleaning before and after the slot.",
                roomBookingConflictNextAvailable: "Next available at {time}",
                roomBookingSuccess: "Room booked!",
                roomReleaseButton: "Cancel booking",
                step1: "1. CART", step2: "2. CHECKOUT", courierLabel: "🚚 Courier delivery",
                courierPrice: "+20,000 sum", backToCartBtn: "← Back to cart", checkoutTitle: "Checkout",
                nameLabel: "Your name *", phoneLabel: "Phone number *", phoneHelp: "+998 cannot be removed, auto-formatted",
                addressLabel: "Address *", addressHelp: "\"Namangan,\" is prefilled, address must be at least 18 characters", addressRequiredError: "Please enter your address", addressLengthError: "Address must be at least 18 characters long", noteLabel: "Note (optional)",
                promoLabel: "Promo code", submitOrderBtn: "PLACE ORDER", aboutTitle: "About Us",
                aboutText1: "AHMADBEK majmuasi — 2020", aboutCloseBtn: "CLOSE", footerText: "AHMADBEK majmuasi © 2020 | 171+ dishes",
                footerCopyright: "All rights reserved © 2020", mobileProfileText: "Profile", mobileOrdersText: "My orders",
                mobileRoomsText: "Rooms", mobileCartText: "Cart", mobileAboutText: "About Us", mobileAdminText: "Admin panel",
                profileTitle: "👤 Profile", loginTitle: "Login", loginPhoneLabel: "Phone",
                loginPasswordLabel: "Password", loginBtn: "Login", registerTitle: "Register", regNameLabel: "Name",
                regPhoneLabel: "Phone", regPasswordLabel: "Password", regConfirmLabel: "Confirm password",
                registerBtn: "Register", profileNameLabel: "Name", profilePhoneLabel: "Phone",
                saveProfileBtn: "Save", logoutProfileBtn: "Logout",
                roomAvailable: "Free", roomBooked: "Booked",
                roomTempBooked: "Temporarily booked",
                roomsBookedListTitle: "📅 Booked rooms",
                roomsBookedListEmpty: "No room bookings yet",
                notificationProductAdded: "✅ Product added",
                notificationProductRemoved: "❌ Product removed",
                cartBtnText: "ORDER",
                aboutLocation: "Namangan, Amir Temur street, 103",
                aboutPhone1: "+998 95 300 88 88",
                aboutTG1: "https://t.me/AHMADBEKrestogroup",
                aboutName: "Odilov Abdulquddus",
                aboutPhone2: "+998 90 260 88 88",
                aboutTG2: "https://t.me/odilovabdulquddus",
                orderStatusPreparing: "Preparing",
                orderStatusCourier: "Courier",
                orderStatusReady: "Ready",
                orderStatusTakeaway: "Take away",
                totalText: "Total:",
                currencySymbol: "sum",
                selectFromMap: "🗺️ Select from map",
                confirmLocation: "📍 Confirm this location",
                cancel: "Cancel",
                mapApiMissing: "Map did not load. Check internet access or blocked links.",
                mapPickFirst: "Please select a location on the map first!",
                mapGeocodeError: "Could not detect the address. Please choose another location.",
                mapLoadError: "Map did not load. Check internet access or blocked links, then refresh the page.",
                mapSelectedTitle: "✅ Location selected",
                mapSelectedMsg: "Address added from the map",
                mapSearchPlaceholder: "Search...",
                mapLayersText: "Layers",
                mapSearchBtnTitle: "Search",
                mapMyLocationBtnTitle: "My location",
                mapLayerStandard: "Standard",
                mapLayerSatellite: "Satellite",
                mapLayerDark: "Dark",
                mapSearchNoResults: "No results found",
                mapSearchError: "Search error. Check internet.",
                mapMyLocationUnsupported: "Geolocation is not supported.",
                mapMyLocationDenied: "Location permission denied.",
                mapMyLocationOutside: "Your location is outside Uzbekistan.",
                // Yangi qo'shimcha tarjimalar
                notificationRegisterSuccess: "✅ Congratulations, you have registered!",
                notificationRegisterMessage: "",
                notificationLoginSuccess: "✅ You are logged in",
                notificationLoginMessage: "Welcome!",
                notificationLogoutSuccess: "✅ You are logged out",
                notificationLogoutMessage: "Goodbye!",
                notificationProfileSaved: "✅ Profile saved!",
                notificationProfileSavedMsg: "Your data has been updated",
                notificationPhoneExists: "This phone is on the list!",
                notificationPhoneExistsMsg: "Enter another number",
                notificationOrderSuccess: "✅ Your order has been received!",
                notificationOrderMsg: "We will contact you soon",
                productAddedMsg: "added to cart",
                productRemovedMsg: "removed from cart",
                noOrdersYet: "📭 No orders yet",
                maxOrderText: "Max: ",
                maxOrderUnit: " pieces"
            }
        };
        // ==================== YORDAMCHI FUNKSIYALAR ====================
        function isValidUzbekPhone(phone) {
            const cleanPhone = phone.replace(/\s/g, '');
            if (!cleanPhone.startsWith('+998')) return false;
            if (cleanPhone.length !== 13) return false;
            const operatorCode = cleanPhone.substring(4, 6);
            return UZBEK_OPERATORS.includes(operatorCode);
        }

        function formatPhoneNumber(input) {
            let value = input.value.replace(/\D/g, '');
            if (!value.startsWith('998')) value = '998' + value;
            if (value.length > 12) value = value.slice(0, 12);
            let formatted = '+998 ';
            if (value.length > 3) {
                formatted += value.slice(3, 5);
                if (value.length > 5) formatted += ' ' + value.slice(5, 8);
                if (value.length > 8) formatted += ' ' + value.slice(8, 10);
                if (value.length > 10) formatted += ' ' + value.slice(10, 12);
            }
            input.value = formatted;
        }
        function formatPhone(input) { formatPhoneNumber(input); }

        let pendingNotification = null;
        function showNotification(title, message, type, productId = null) {
            const notification = document.getElementById('notification');
            const icon = document.getElementById('notificationIcon');
            const titleEl = document.getElementById('notificationTitle');
            const messageEl = document.getElementById('notificationMessage');
            notification.classList.remove('success', 'danger');
            notification.classList.add(type);
            titleEl.textContent = title;
            messageEl.textContent = message;
            icon.innerHTML = type === 'success' ? '✅' : '❌';
            notification.classList.add('show');
            if (notificationTimeout) clearTimeout(notificationTimeout);

            if (pendingNotification) {
                notification.removeEventListener('click', pendingNotification);
            }
            if (title === "✅ Mahsulot qo'shildi" || title === "✅ Товар добавлен" || title === "✅ Product added") {
                pendingNotification = () => {
                    togglePanel('cartPanel');
                    hideNotification();
                };
                notification.addEventListener('click', pendingNotification);
            }

            notificationTimeout = setTimeout(() => {
                hideNotification();
                if (pendingNotification) {
                    notification.removeEventListener('click', pendingNotification);
                    pendingNotification = null;
                }
            }, 5000);
        }

        function hideNotification() { document.getElementById('notification').classList.remove('show'); }
        function handleNotificationClick() { hideNotification(); }

        // ==================== XARITA FUNKSIYALARI (Leaflet + OpenStreetMap) ====================
        let selectedMapLocation = null;
        let selectedLocation = null; // {lat, lng}
        let mapInstance = null;
        let mapMarker = null;
        let mapActiveLayer = 'standard';
        let mapLayers = null;

        // Approx Uzbekistan bounds (to keep the map inside the country).
        const UZ_BOUNDS = { south: 37.0, west: 55.9, north: 45.6, east: 73.3 };
        const UZ_CENTER = { lat: 40.9983, lng: 71.6728 };

        function openMapModal() {
            const d = langData[currentLang];
            if (!window.L) {
                alert(d.mapLoadError);
                return;
            }
            document.getElementById('mapModal').classList.add('active');
            initMapCanvas();
            if (!mapInstance) {
                alert(d.mapLoadError);
                return;
            }
            updateMapUiText();
            renderLayersPanel();
            setTimeout(() => {
                try {
                    mapInstance.invalidateSize();
                    if (selectedLocation) mapInstance.panTo([selectedLocation.lat, selectedLocation.lng]);
                } catch { }
            }, 80);

            if (selectedLocation) {
                mapInstance.panTo([selectedLocation.lat, selectedLocation.lng]);
                placeMapMarker(selectedLocation);
            }
        }

        function closeMapModal() {
            document.getElementById('mapModal').classList.remove('active');
        }

        function initMapCanvas() {
            if (mapInstance || !window.L) return;

            const bounds = window.L.latLngBounds(
                [UZ_BOUNDS.south, UZ_BOUNDS.west],
                [UZ_BOUNDS.north, UZ_BOUNDS.east]
            );

            mapInstance = window.L.map('mapCanvas', {
                center: [UZ_CENTER.lat, UZ_CENTER.lng],
                zoom: 13,
                minZoom: 6,
                maxZoom: 19,
                maxBounds: bounds,
                maxBoundsViscosity: 1.0,
                zoomControl: true
            });

            mapLayers = {
                standard: window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '&copy; OpenStreetMap contributors'
                }),
                satellite: window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    maxZoom: 19,
                    attribution: 'Tiles &copy; Esri'
                }),
                dark: window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                    maxZoom: 19,
                    subdomains: 'abcd',
                    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
                })
            };
            applyMapLayer(mapActiveLayer);

            mapInstance.on('click', (e) => {
                if (!e || !e.latlng) return;
                selectedLocation = { lat: e.latlng.lat, lng: e.latlng.lng };
                placeMapMarker(selectedLocation);
            });

            const searchInput = document.getElementById('mapSearchInput');
            if (searchInput) {
                searchInput.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter') {
                        ev.preventDefault();
                        searchOnMap();
                    }
                });
            }
        }

        function placeMapMarker(position) {
            if (!mapInstance || !window.L || !position) return;
            if (!mapMarker) {
                mapMarker = window.L.marker([position.lat, position.lng]).addTo(mapInstance);
            } else {
                mapMarker.setLatLng([position.lat, position.lng]);
            }
        }

        function toggleLayersPanel() {
            const panel = document.getElementById('mapLayersPanel');
            if (!panel) return;
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }

        function setMapLayer(layerKey) {
            if (mapActiveLayer === layerKey) return;
            mapActiveLayer = layerKey;
            applyMapLayer(mapActiveLayer);
            renderLayersPanel();
        }

        function applyMapLayer(layerKey) {
            if (!mapInstance || !mapLayers) return;
            Object.values(mapLayers).forEach((layer) => {
                if (mapInstance.hasLayer(layer)) mapInstance.removeLayer(layer);
            });
            const nextLayer = mapLayers[layerKey] || mapLayers.standard;
            nextLayer.addTo(mapInstance);
        }

        function renderLayersPanel() {
            const d = langData[currentLang];
            const panel = document.getElementById('mapLayersPanel');
            if (!panel) return;
            panel.innerHTML = `
                <button type="button" onclick="setMapLayer('standard')" class="${mapActiveLayer === 'standard' ? 'active' : ''}">${d.mapLayerStandard}</button>
                <button type="button" onclick="setMapLayer('satellite')" class="${mapActiveLayer === 'satellite' ? 'active' : ''}">${d.mapLayerSatellite}</button>
                <button type="button" onclick="setMapLayer('dark')" class="${mapActiveLayer === 'dark' ? 'active' : ''}">${d.mapLayerDark}</button>
            `;
        }

        function updateMapUiText() {
            const d = langData[currentLang];
            const search = document.getElementById('mapSearchInput');
            if (search) search.placeholder = d.mapSearchPlaceholder;
            const layersText = document.getElementById('mapLayersText');
            if (layersText) layersText.innerText = d.mapLayersText;
            const btnSearch = document.getElementById('mapSearchBtn');
            if (btnSearch) btnSearch.title = d.mapSearchBtnTitle;
            const btnLoc = document.getElementById('mapMyLocationBtn');
            if (btnLoc) btnLoc.title = d.mapMyLocationBtnTitle;
        }

        async function reverseGeocode(lat, lng, lang) {
            try {
                const language = lang === 'ru' ? 'ru' : (lang === 'uz' ? 'uz' : 'en');
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&accept-language=${encodeURIComponent(language)}`);
                if (!res.ok) return null;
                const data = await res.json();
                return data?.display_name || null;
            } catch {
                return null;
            }
        }

        async function searchOnMap() {
            const d = langData[currentLang];
            const input = document.getElementById('mapSearchInput');
            const q = (input ? input.value : '').trim();
            if (!q) return;
            try {
                const language = currentLang === 'ru' ? 'ru' : (currentLang === 'uz' ? 'uz' : 'en');
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=uz&accept-language=${encodeURIComponent(language)}&q=${encodeURIComponent(q)}`);
                if (!res.ok) throw new Error('search failed');
                const results = await res.json();
                if (results.length === 0) {
                    alert(d.mapSearchNoResults);
                    return;
                }
                const lat = Number(results[0]?.lat);
                const lng = Number(results[0]?.lon);
                if (!isFinite(lat) || !isFinite(lng)) {
                    alert(d.mapSearchNoResults);
                    return;
                }
                selectedLocation = { lat, lng };
                placeMapMarker(selectedLocation);
                mapInstance.setZoom(16);
                mapInstance.panTo([lat, lng]);
            } catch (e) {
                alert(d.mapSearchError);
            }
        }

        function showMyLocation() {
            const d = langData[currentLang];
            if (!navigator.geolocation) {
                alert(d.mapMyLocationUnsupported);
                return;
            }
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    const inside = lat >= UZ_BOUNDS.south && lat <= UZ_BOUNDS.north && lng >= UZ_BOUNDS.west && lng <= UZ_BOUNDS.east;
                    if (!inside) {
                        alert(d.mapMyLocationOutside);
                        return;
                    }
                    selectedLocation = { lat, lng };
                    placeMapMarker(selectedLocation);
                    mapInstance.setZoom(16);
                    mapInstance.panTo([lat, lng]);
                    await selectLocationFromMap();
                },
                () => alert(d.mapMyLocationDenied),
                { enableHighAccuracy: true, timeout: 8000 }
            );
        }

        async function selectLocationFromMap() {
            const d = langData[currentLang];
            if (!selectedLocation) {
                alert(d.mapPickFirst);
                return;
            }

            const lat = Number(selectedLocation.lat);
            const lng = Number(selectedLocation.lng);
            const addressInput = document.getElementById('addressInput');

            const address = await reverseGeocode(lat, lng, currentLang);
            if (addressInput) {
                if (address) {
                    if (address.toLowerCase().includes('namangan')) addressInput.value = address;
                    else addressInput.value = 'Namangan, ' + address;
                } else {
                    addressInput.value = `Namangan, ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                }
            }

            selectedMapLocation = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
            validateAddress(false);
            showNotification(d.mapSelectedTitle, d.mapSelectedMsg, "success");
            closeMapModal();
            refreshCheckoutAddressSection();
        }

        // ==================== PROFIL FUNKSIYALARI ====================
        function createProfileDropdown() {
            const d = langData[currentLang];
            const dropdown = document.getElementById('profileDropdown');
            dropdown.innerHTML = `
            <div class="profile-dropdown-header"><span style="font-weight:700; color:var(--primary);">${d.profileTitle}</span><button type="button" class="profile-dropdown-close" onclick="closeProfileDropdown()"><i class="fas fa-times"></i><span>Yopish</span></button></div>
            <div id="profileNotLoggedIn"><div class="tab-buttons"><button class="tab-button active" onclick="switchAuthTab('login')">${d.loginTitle}</button><button class="tab-button" onclick="switchAuthTab('register')">${d.registerTitle}</button></div>
            <div id="loginForm" class="form-tab active"><div class="profile-field"><label>${d.loginPhoneLabel}</label><input type="text" id="loginPhone" value="+998 " oninput="formatPhone(this)"></div><div class="profile-field"><label>${d.loginPasswordLabel}</label><input type="password" id="loginPassword"></div><button class="save-profile-btn" onclick="loginUser()">${d.loginBtn}</button></div>
            <div id="registerForm" class="form-tab" style="display:none;"><div class="profile-field"><label>${d.regNameLabel}</label><input type="text" id="regName"></div><div class="profile-field"><label>${d.regPhoneLabel}</label><input type="text" id="regPhone" value="+998 " oninput="formatPhone(this)"></div><div class="profile-field"><label>${d.regPasswordLabel}</label><input type="password" id="regPassword"></div><div class="profile-field"><label>${d.regConfirmLabel}</label><input type="password" id="regConfirmPassword"></div><button class="save-profile-btn" onclick="registerUser()">${d.registerBtn}</button></div></div>
            <div id="profileLoggedIn" style="display:none;"><div class="profile-header"><div class="profile-avatar" onclick="changeProfilePicture()"><img id="profileAvatar" src="https://via.placeholder.com/60"></div><div class="profile-info"><h4 id="profileFullName"></h4><p id="profilePhoneDisplay"></p><p id="profileStatus"></p></div></div>
            <div class="profile-field"><label>${d.profileNameLabel}</label><input type="text" id="profileNameInput"></div>
            <div class="profile-field"><label>${d.profilePhoneLabel}</label><input type="text" id="profilePhoneInput"></div>
            <button class="save-profile-btn" onclick="updateProfile()">${d.saveProfileBtn}</button>
            <button class="logout-btn" onclick="logoutUser()">${d.logoutProfileBtn}</button></div>`;
        }

	        function toggleProfileDropdown() {
	            const d = document.getElementById('profileDropdown');
	            if (!d) return;
	            if (d.classList.contains('active')) closeProfileDropdown();
	            else openProfileDropdown();
	        }
	        function closeProfileDropdown() {
	            const dropdown = document.getElementById('profileDropdown');
	            if (dropdown) dropdown.classList.remove('active');
	        }
	        function closeSecondaryUiOverlays() {
	            const cartPanel = document.getElementById('cartPanel');
	            if (cartPanel) cartPanel.classList.remove('active');
	            const myOrdersPanel = document.getElementById('myOrdersPanel');
	            if (myOrdersPanel) myOrdersPanel.classList.remove('active');
	            const roomsPanel = document.getElementById('roomsPanel');
	            if (roomsPanel) roomsPanel.classList.remove('active');
	            const adminPanel = document.getElementById('adminPanel');
	            if (adminPanel) adminPanel.classList.remove('active');
	            closeMobileMenu();
	            closeMapModal();
	            try { closeImageModal(); } catch (e) {
	                const imageModal = document.getElementById('imageModal');
	                const imageModalImg = document.getElementById('imageModalImg');
	                if (imageModal) imageModal.classList.remove('active');
	                if (imageModalImg) imageModalImg.src = '';
	            }
	            toggleAbout(false);
	        }
	        function openProfileDropdown() {
	            const d = document.getElementById('profileDropdown');
	            if (!d) return;
	            closeSecondaryUiOverlays();
	            d.classList.add('active');
	            updateProfileDropdown();
	        }

            function openMobileProfile() {
                closeMobileMenu();
                openProfileDropdown();
            }

	        function closeAllUiOverlays() {
	            closeSecondaryUiOverlays();
	            closeProfileDropdown();
	        }

        function switchAuthTab(tab) {
            const login = document.getElementById('loginForm'), reg = document.getElementById('registerForm'), btns = document.querySelectorAll('#profileDropdown .tab-button');
            if (tab === 'login') { btns[0].classList.add('active'); btns[1].classList.remove('active'); login.style.display = 'block'; reg.style.display = 'none'; }
            else { btns[0].classList.remove('active'); btns[1].classList.add('active'); login.style.display = 'none'; reg.style.display = 'block'; }
        }

        async function loginUser() {
            const d = langData[currentLang];
            const phone = document.getElementById('loginPhone').value.trim();
            const password = document.getElementById('loginPassword').value.trim();
            if (!isValidUzbekPhone(phone)) { alert("❌ Noto'g'ri telefon raqam!"); return; }
            if (!password) { alert("Parolni kiriting!"); return; }
            try {
                const data = await apiRequest('/api/auth/login', {
                    method: 'POST',
                    body: { phone, password }
                });
                setAuthToken(data.token || '');
                setCurrentUserState(data.user || null);
                await loadOrdersData();
                updateProfileDropdown(); updateCheckoutForm(); displayProducts(currentCategory); displayMyOrders(); closeProfileDropdown();
                showNotification(d.notificationLoginSuccess, d.notificationLoginMessage, "success");
            } catch (error) {
                alert(error.message || "Telefon raqam yoki parol noto'g'ri!");
            }
        }

        async function registerUser() {
            const d = langData[currentLang];
            const name = document.getElementById('regName').value.trim();
            const phone = document.getElementById('regPhone').value.trim();
            const password = document.getElementById('regPassword').value.trim();
            const confirmPassword = document.getElementById('regConfirmPassword').value.trim();
            if (!name) { alert("Ismni kiriting!"); return; }
            if (!isValidUzbekPhone(phone)) { alert("❌ Noto'g'ri telefon raqam!"); return; }
            if (!password || password.length < 4) { alert("Parol kamida 4 belgi!"); return; }
            if (password !== confirmPassword) { alert("Parollar mos kelmadi!"); return; }
            try {
                const data = await apiRequest('/api/auth/register', {
                    method: 'POST',
                    body: { name, phone, password }
                });
                setAuthToken(data.token || '');
                setCurrentUserState(data.user || null);
                await loadOrdersData();
                updateProfileDropdown(); updateCheckoutForm(); displayProducts(currentCategory); closeProfileDropdown();
                showNotification(d.notificationRegisterSuccess, d.notificationRegisterMessage, "success");
            } catch (error) {
                if (error.status === 409) showNotification(d.notificationPhoneExists, d.notificationPhoneExistsMsg, "danger");
                else alert(error.message || "Ro'yxatdan o'tishda xato!");
            }
        }

        async function logoutUser() {
            const d = langData[currentLang];
            try { await apiRequest('/api/auth/logout', { method: 'POST' }); } catch { }
            setAuthToken('');
            setCurrentUserState(null);
            orders = readJSONFromLocalStorage('orders', []) || [];
            localStorage.removeItem('cartState');
            products.forEach(p => p.quantity = 0);
            cart = [];
            updateCart();
            updateProfileDropdown();
            displayProducts(currentCategory);
            displayMyOrders();
            closeProfileDropdown();
            updateLoginRequiredMessage();
            document.getElementById('nameInput').value = '';
            document.getElementById('phoneInput').value = '+998 ';
            showNotification(d.notificationLogoutSuccess, d.notificationLogoutMessage, "success");
        }
        function updateProfileDropdown() {
            const d = langData[currentLang];
            if (!currentUser) {
                document.getElementById('profileNotLoggedIn').style.display = 'block';
                document.getElementById('profileLoggedIn').style.display = 'none';
                document.getElementById('profileIcon').innerHTML = '<i class="fas fa-user"></i>';
                return;
            }
            document.getElementById('profileNotLoggedIn').style.display = 'none';
            document.getElementById('profileLoggedIn').style.display = 'block';
            const userData = currentUser;
            document.getElementById('profileFullName').innerText = userData.name;
            document.getElementById('profilePhoneDisplay').innerText = userData.phone;
            document.getElementById('profileNameInput').value = userData.name;
            document.getElementById('profilePhoneInput').value = userData.phone;
            const statusEl = document.getElementById('profileStatus');
            if (userData.blocked) statusEl.innerHTML = '<span class="badge badge-danger">Bloklangan</span>';
            else if (userData.isAdmin) statusEl.innerHTML = '<span class="badge badge-admin">⚜️ Admin</span>';
            else statusEl.innerHTML = `<span class="badge badge-success">${d.maxOrderText}${userData.maxOrder}${d.maxOrderUnit}</span>`;
            if (userData.avatar) document.getElementById('profileIcon').innerHTML = `<img src="${userData.avatar}" style="width:100%;height:100%;object-fit:cover;">`;
            else document.getElementById('profileIcon').innerHTML = '<i class="fas fa-user"></i>';
            updateLoginRequiredMessage();
        }

        async function updateProfile() {
            const d = langData[currentLang];
            if (!currentUser) return;
            const name = document.getElementById('profileNameInput').value.trim();
            const phone = document.getElementById('profilePhoneInput').value.trim();
            if (!name) { alert("Ismni kiriting!"); return; }
            if (!isValidUzbekPhone(phone)) { alert("❌ Noto'g'ri telefon raqam!"); return; }
            try {
                const data = await apiRequest('/api/auth/me', {
                    method: 'PATCH',
                    body: { name, phone }
                });
                setCurrentUserState(data.user || currentUser);
                updateProfileDropdown();
                showNotification(d.notificationProfileSaved, d.notificationProfileSavedMsg, "success");
            } catch (error) {
                if (error.status === 409) showNotification(d.notificationPhoneExists, d.notificationPhoneExistsMsg, "danger");
                else alert(error.message || "Profilni saqlashda xato!");
            }
        }

        async function changeProfilePicture() {
            if (!currentUser) return;
            const url = prompt("Rasm URL:", currentUser.avatar);
            if (url) {
                try {
                    const data = await apiRequest('/api/auth/me', {
                        method: 'PATCH',
                        body: { name: currentUser.name, phone: currentUser.phone, avatar: url }
                    });
                    setCurrentUserState(data.user || currentUser);
                    updateProfileDropdown();
                } catch (error) {
                    alert(error.message || "Avatarni saqlashda xato!");
                }
            }
        }

        function updateCheckoutForm() {
            if (currentUser) {
                document.getElementById('nameInput').value = currentUser.name || '';
                document.getElementById('phoneInput').value = currentUser.phone || '+998 ';
            }
        }

        function updateLoginRequiredMessage() {
            const msg = document.getElementById('loginRequiredMessage'), btn = document.getElementById('checkoutBtn');
            if (!currentUser) { msg.style.display = 'block'; if (btn) btn.disabled = true; }
            else {
                const u = currentUser;
                if (u && u.blocked) { msg.style.display = 'block'; if (btn) btn.disabled = true; }
                else { msg.style.display = 'none'; if (btn) btn.disabled = false; }
            }
        }

        // ==================== MAHSULOTLAR (193 TA) ====================
        const defaultProducts = [
            // ========== SALATLAR (1-33) ==========
            { id: "1", cat: "salat", name: { uz: "Olivia salati", ru: "Салат Оливье", en: "Olivye salad" }, weight: "250g", price: 41200, img: "Menyu/olivye.png", quantity: 0 },
            { id: "2", cat: "salat", name: { uz: "Fransuz salati", ru: "Французский салат", en: "French salad" }, weight: "250g", price: 44300, img: "Menyu/fransuz_salat.png", quantity: 0 },
            { id: "3", cat: "salat", name: { uz: "Kapriz", ru: "Мужской каприз", en: "Kapriz" }, weight: "300g", price: 59500, img: "Menyu/kapriz.png", quantity: 0 },
            { id: "4", cat: "salat", name: { uz: "Amerikan salati", ru: "Американский салат", en: "Amerika salat" }, weight: "250g", price: 44700, img: "Menyu/amerika.png", quantity: 0 },
            { id: "5", cat: "salat", name: { uz: "Kapriz", ru: "Дамский каприз", en: "Capriz" }, weight: "250g", price: 59500, img: "Menyu/capriz.png", quantity: 0 },
            { id: "6", cat: "salat", name: { uz: "Govurilgan baqlajon salatasi", ru: "Салат из жареного баклажана", en: "Karami Patlıcan Salata" }, weight: "300g", price: 63000, img: "Menyu/baqlajonli_salat.png", quantity: 0 },
            { id: "7", cat: "salat", name: { uz: "Sezar", ru: "Цезарь", en: "Sezar" }, weight: "250g", price: 45700, img: "Menyu/sezar.png", quantity: 0 },
            { id: "8", cat: "salat", name: { uz: "Ahmadsheyx", ru: "Ахмадшейх", en: "Ahmedseyx" }, weight: "300g", price: 65700, img: "Menyu/ahmedseyx.png", quantity: 0 },
            { id: "9", cat: "salat", name: { uz: "Qoziqorinli tovuq", ru: "Курица с грибами", en: "Mantarlı Tavuk" }, weight: "300g", price: 41200, img: "Menyu/qozi_tovuq.png", quantity: 0 },
            { id: "10", cat: "salat", name: { uz: "Yapon salat", ru: "Японский салат", en: "Yapon salata" }, weight: "250g", price: 48300, img: "Menyu/yapon.png", quantity: 0 },
            { id: "11", cat: "salat", name: { uz: "Cho'pon salati", ru: "Чобан", en: "Choban" }, weight: "300g", price: 39000, img: "Menyu/chopon_salat.png", quantity: 0 },
            { id: "12", cat: "salat", name: { uz: "Okroshka salatasi", ru: "Салат Окрошка", en: "Okroşka Salatası" }, weight: "200g", price: 13500, img: "Menyu/okroshka.png", quantity: 0 },
            { id: "13", cat: "salat", name: { uz: "Suzma", ru: "Сузьма", en: "Suzma" }, weight: "200g", price: 6000, img: "Menyu/suzma.png", quantity: 0 },
            { id: "14", cat: "salat", name: { uz: "Rus go'sht salatasi", ru: "Салат Фрунзе", en: "Rus Go'shti Salatasi" }, weight: "300g", price: 44700, img: "Menyu/rus_gosh_salati.png", quantity: 0 },
            { id: "15", cat: "salat", name: { uz: "Bahor vitaminli salat", ru: "Салат Весенние витамины", en: "Bahar Vitamin Salata" }, weight: "250g", price: 34800, img: "Menyu/bahor_salati.png", quantity: 0 },
            { id: "16", cat: "salat", name: { uz: "Svejiy salat", ru: "Свежий салат", en: "Sofya salata" }, weight: "250g", price: 22000, img: "Menyu/svejiy_salat.png", quantity: 0 },
            { id: "17", cat: "salat", name: { uz: "Smak", ru: "Смак", en: "Smak" }, weight: "250g", price: 41000, img: "Menyu/smak.png", quantity: 0 },
            { id: "18", cat: "salat", name: { uz: "Gril sabzavotlar", ru: "Овощи на гриле", en: "Izgara Sebzeler" }, weight: "300g", price: 38000, img: "Menyu/sabzavot.png", quantity: 0 },
            { id: "19", cat: "salat", name: { uz: "Tuzli assorti", ru: "Соленья ассорти", en: "Turşu Karışık" }, weight: "200g", price: 40800, img: "Menyu/tuzli_assorti.png", quantity: 0 },
            { id: "20", cat: "salat", name: { uz: "Sabzavotli assorti", ru: "Овощной ассорти", en: "Sebze Karışık" }, weight: "300g", price: 45100, img: "Menyu/sabzavotli_assort.png", quantity: 0 },
            { id: "21", cat: "salat", name: { uz: "Tuzlama", ru: "Соленья", en: "Turşma" }, weight: "250g", price: 27000, img: "Menyu/tuzlama.png", quantity: 0 },
            { id: "22", cat: "salat", name: { uz: "Yunon salat", ru: "Греческий салат", en: "Yunan salata" }, weight: "300g", price: 44000, img: "Menyu/yunon_salat.png", quantity: 0 }, 
            { id: "23", cat: "salat", name: { uz: "Qatiq", ru: "Катык", en: "Katik" }, weight: "200g", price: 5000, img: "Menyu/qatiq.png", quantity: 0 },
            { id: "26", cat: "salat", name: { uz: "Meva assorti", ru: "Фруктовый ассорти", en: "Meyve Tabağı" }, weight: "350g", price: 121000, img: "Menyu/meva_salat.png", quantity: 0 },
            { id: "27", cat: "salat", name: { uz: "Avakado salatasi", ru: "Салат с курицей и авокадо", en: "Avokado Salatası" }, weight: "250g", price: 64500, img: "Menyu/avokado.png", quantity: 0 },
            { id: "28", cat: "salat", name: { uz: "Tulum Pishloqli Roka Salatasi", ru: "Салат с рукколой и сыром", en: "Tukan Peynirli Roka Salata" }, weight: "250g", price: 58000, img: "Menyu/tulum_pishloqli.png", quantity: 0 },
            { id: "29", cat: "salat", name: { uz: "Qovurilgan tovuq salatasi", ru: "Салат с курицей гриль", en: "Tavuk Salatası" }, weight: "300g", price: 56000, img: "Menyu/qovurilgan_tovuq.png", quantity: 0 },
            { id: "30", cat: "salat", name: { uz: "Parxez", ru: "Пархез", en: "Parxez" }, weight: "250g", price: 41200, img: "Menyu/parxez.png", quantity: 0 },
            { id: "31", cat: "salat", name: { uz: "Gavurdag‘i salati", ru: "Салат «Гавурдаги»", en: "Gavurdag‘i Salati" }, weight: "250g", price: 41200, img: "Menyu/Gavur.png", quantity: 0 },
            { id: "38", cat: "milliy", name: { uz: "Chuchvara", ru: "Жувава", en: "Chuchvara" }, weight: "400g", price: 36500, img: "Menyu/chuchvaar.png", quantity: 0 },
            { id: "39", cat: "milliy", name: { uz: "Lag'mon", ru: "Лагман", en: "Lagman" }, weight: "500g", price: 36500, img: "Menyu/lagman.png", quantity: 0 },
            { id: "40", cat: "milliy", name: { uz: "Bifstrogan", ru: "Бефстроганов", en: "Bifstrogan" }, weight: "400g", price: 61000, img: "Menyu/bifstrogan.png", quantity: 0 },
            { id: "41", cat: "milliy", name: { uz: "Osh", ru: "Плов", en: "Ash" }, weight: "500g", price: 36700, img: "Menyu/ash.png", quantity: 0 },
            { id: "42", cat: "milliy", name: { uz: "Qotirma", ru: "Котирма", en: "Qotirma" }, weight: "400g", price: 78000, img: "Menyu/qotirma.png", quantity: 0 },
            { id: "43", cat: "milliy", name: { uz: "Uy go'shti", ru: "Мясо по домашнему", en: "Uy Yapim Et" }, weight: "400g", price: 74800, img: "Menyu/uy_goshti.png", quantity: 0 },
            { id: "44", cat: "milliy", name: { uz: "Qovurma Lag'mon", ru: "Жареный лагман", en: "Kavurma lagman" }, weight: "450g", price: 36500, img: "Menyu/qovurma_lagman.png", quantity: 0 },
            { id: "45", cat: "milliy", name: { uz: "Shorva", ru: "Суп", en: "Sorva" }, weight: "400ml", price: 39000, img: "Menyu/shorva.png", quantity: 0 }, 
            { id: "46", cat: "milliy", name: { uz: "Mastava", ru: "Мастава", en: "Mastava" }, weight: "400ml", price: 32000, img: "Menyu/masatava.png", quantity: 0 },
            { id: "47", cat: "milliy", name: { uz: "Qozon kabob", ru: "Казан кебаб", en: "Kazan kobab" }, w: "400g", price: 35100, img: "Menyu/qozon_kabob.png", quantity: 0 },
            { id: "48", cat: "milliy", name: { uz: "Sumburu", ru: "Сумбуру", en: "Sumburu" }, weight: "500g", price: 165800, img: "Menyu/sumburu.png", quantity: 0 },
            { id: "49", cat: "milliy", name: { uz: "Sukuru", ru: "Сукуру", en: "Sukuru" }, weight: "500g", price: 165800, img: "Menyu/sukuru.png", quantity: 0 }, // I need all convert .pngs to .pngs
            { id: "50", cat: "milliy", name: { uz: "Tandir", ru: "Тандыр", en: "Tandir" }, weight: "200g", price: 10000, img: "Menyu/tandir.png", quantity: 0 },
            { id: "51", cat: "milliy", name: { uz: "Baliq", ru: "Рыба", en: "Baliq" }, weight: "300g", price: 60000, img: "Menyu/baliq.png", quantity: 0 },
            { id: "52", cat: "milliy", name: { uz: "Tomchi somsa (Mol)", ru: "Капля Самса", en: "Damla Somsa" }, weight: "300g", price: 11000, img: "Menyu/tomchi_somsa.png", quantity: 0 },
            { id: "53", cat: "milliy", name: { uz: "Tomchi somsa (Qo'y)", ru: "Капля Самса", en: "Damla Somsa" }, weight: "300g", price: 12500, img: "Menyu/tomchi_somsa.png", quantity: 0 },
            { id: "54", cat: "milliy", name: { uz: "Shilpildoq", ru: "Шилпилдок", en: "Hamir usti et" }, weight: "400g", price: 70100, img: "Menyu/shilpildoq.png", quantity: 0 },
            { id: "55", cat: "milliy", name: { uz: "KFC", ru: "Кепсе", en: "KFC" }, weight: "300g", price: 32100, img: "Menyu/kfc.png", quantity: 0 },
            { id: "56", cat: "milliy", name: { uz: "Manti", ru: "Манты", en: "Manti" }, weight: "400g", price: 8500, img: "Menyu/manti.png", quantity: 0 },
            { id: "57", cat: "milliy", name: { uz: "Ayrim say", ru: "Айрим сай", en: "Ayrim say" }, weight: "400g", price: 36600, img: "Menyu/ayrim_say.png", quantity: 0 },
            { id: "58", cat: "milliy", name: { uz: "Gijduvon", ru: "Гиждуван", en: "Gijduvon" }, weight: "200g", price: 19000, img: "Menyu/gidivon_mol_goshti_qoy_goshti_qiyma.png", quantity: 0 },
            { id: "59", cat: "milliy", name: { uz: "Mol go'shti shashlik", ru: "Говядина", en: "Mol eti" }, weight: "200g", price: 26000, img: "Menyu/gidivon_mol_goshti_qoy_goshti_qiyma.png", quantity: 0 },
            { id: "60", cat: "milliy", name: { uz: "Qo'y go'shti shashlik", ru: "Баранина", en: "Kuzu eti" }, weight: "200g", price: 28000, img: "Menyu/gidivon_mol_goshti_qoy_goshti_qiyma.png", quantity: 0 },
            { id: "61", cat: "milliy", name: { uz: "Qiyma shashlik", ru: "Молотый", en: "Kiyma" }, weight: "200g", price: 19000, img: "Menyu/gidivon_mol_goshti_qoy_goshti_qiyma.png", quantity: 0 },
            { id: "62", cat: "milliy", name: { uz: "Norin + Qazi", ru: "Нарын + Кази", en: "Norin + Qazi" }, weight: "400g", price: 39500, img: "Menyu/norin+qazi.png", quantity: 0 },
            { id: "63", cat: "milliy", name: { uz: "Assorti", ru: "Ассорти", en: "Assorti" }, weight: "500g", price: 101600, img: "Menyu/assorti.png", quantity: 0 },

            // ========== YEVROPA VA TURK (64-109) ==========
            { id: "64", cat: "yevropa", name: { uz: "Hasan Posho kotleti", ru: "Котлет Хасан Паша", en: "Hasan Paşa Köftesi" }, weight: "250g", price: 44600, img: "Menyu/hasan_posho.png", quantity: 0 },
            { id: "65", cat: "yevropa", name: { uz: "Sabzavotli go'sht", ru: "Мясо с овощами", en: "Sebzeli Et Sote" }, weight: "350g", price: 48800, img: "Menyu/sabzavotli_gosht.png", quantity: 0 },
            { id: "66", cat: "yevropa", name: { uz: "Lula pomidor qaylasida", ru: "Люля в томате", en: "Domates Soslu Lüle Kebap" }, weight: "300g", price: 46600, img: "Menyu/lula_pomidor_qaylasi.png", quantity: 0 },
            { id: "67", cat: "yevropa", name: { uz: "Sabzavotli tovuq", ru: "Курица с овощами", en: "Mantarlı tavuk" }, weight: "350g", price: 40700, img: "Menyu/sabzavotli_tovuq.png", quantity: 0 },
            { id: "68", cat: "yevropa", name: { uz: "Pishloqli kotletlar", ru: "Котлеты с сыром", en: "Kaşarlı Köfte" }, weight: "300g", price: 73800, img: "Menyu/sirli_kotlet.png", quantity: 0 },
            { id: "69", cat: "yevropa", name: { uz: "Sarma betiy", ru: "Сарма бетий", en: "Sarma betiy" }, weight: "400g", price: 71000, img: "Menyu/sarma_betiy.png", quantity: 0 },
            { id: "70", cat: "yevropa", name: { uz: "Ilik", ru: "Илик", en: "İlik" }, weight: "300g", price: 83000, img: "Menyu/ilik.png", quantity: 0 },
            { id: "71", cat: "yevropa", name: { uz: "Baqlajonli go'sht", ru: "Мясо с баклажанами", en: "Patlıcanlı Et Sote" }, weight: "350g", price: 49800, img: "Menyu/baqlajonli_gosht.png", quantity: 0 },
            { id: "72", cat: "yevropa", name: { uz: "Tovuqli frikase", ru: "Фрикасе из курицы с грибами", en: "Mantarlı Tavuk Frikase" }, weight: "350g", price: 72500, img: "Menyu/tovuqli_frikase.png", quantity: 0 },
            { id: "73", cat: "yevropa", name: { uz: "Tovuq va qo'ziqorin", ru: "Курица с грибами", en: "Mantarlı tavuk" }, weight: "350g", price: 42000, img: "Menyu/tovuq_va_qoziqorin.jpg", quantity: 0 },
            { id: "74", cat: "yevropa", name: { uz: "Go'sht donar", ru: "Донер", en: "Et doner" }, weight: "350g", price: 85000, img: "Menyu/donar.png", quantity: 0 },
            { id: "75", cat: "yevropa", name: { uz: "Iskander", ru: "Искандер", en: "Iskander" }, weight: "350g", price: 76000, img: "Menyu/iskandar.png", quantity: 0 },
            { id: "76", cat: "yevropa", name: { uz: "Oyoqcha", ru: "Ножка", en: "Oyoqcha" }, weight: "250g", price: 89700, img: "Menyu/oyoqcha.png", quantity: 0 },
            { id: "77", cat: "yevropa", name: { uz: "Tok do'lma", ru: "Ток дулма", en: "Tok do'lma" }, weight: "300g", price: 38800, img: "Menyu/tok_dolma.png", quantity: 0 },
            { id: "78", cat: "yevropa", name: { uz: "Golubsi", ru: "Голубцы", en: "Golubsi" }, weight: "300g", price: 38588, img: "Menyu/golubsa.png", quantity: 0 },
            { id: "79", cat: "yevropa", name: { uz: "Tovuq boldiri", ru: "Голень куриный", en: "Fırında Tavuk Baget" }, weight: "300g", price: 63800, img: "Menyu/tovuq_boldiri.png", quantity: 0 },
            { id: "80", cat: "yevropa", name: { uz: "Mejimek", ru: "Мерджимек", en: "Mercimek Çorbası" }, weight: "350ml", price: 28800, img: "Menyu/mejimek.png", quantity: 0 },
            { id: "81", cat: "yevropa", name: { uz: "Til sho'rva", ru: "Суп из языка", en: "Dil çorba" }, weight: "350ml", price: 35400, img: "Menyu/til_shorva.png", quantity: 0 },
            { id: "82", cat: "yevropa", name: { uz: "Teftelli sho'rva", ru: "Суп с фрикадельками", en: "Misket Köfteli Çorba" }, weight: "400ml", price: 28800, img: "Menyu/teftelli_shorva.png", quantity: 0 },
            { id: "83", cat: "yevropa", name: { uz: "Ezogelin", ru: "Эзогелин", en: "Ezogelin Çorbası" }, weight: "400ml", price: 28800, img: "Menyu/ezogelin.png", quantity: 0 },
            { id: "84", cat: "yevropa", name: { uz: "Penne Arabbiata", ru: "Пенне Араббьята", en: "Penne Arrabbiata" }, weight: "350g", price: 75800, img: "Menyu/penne_arabbiata.png", quantity: 0 },
            { id: "85", cat: "yevropa", name: { uz: "Fettuccine Pesto", ru: "Фетучини с соусом Песто", en: "Fettuccine Pesto Soslu" }, weight: "350g", price: 75800, img: "Menyu/Fettuccine_Pesto.png", quantity: 0 },
            { id: "86", cat: "yevropa", name: { uz: "Penne pesto", ru: "Пенне с соусом Песто", en: "Penne Pesto Soslu" }, weight: "350g", price: 75800, img: "Menyu/penne_pesto.png", quantity: 0 },
            { id: "87", cat: "yevropa", name: { uz: "Pasta alfredo", ru: "Паста Альфредо", en: "Pasta Alfredo" }, weight: "350g", price: 75000, img: "Menyu/pasta_alfredo.png", quantity: 0 },
            { id: "88", cat: "yevropa", name: { uz: "Beshamel qaylali Tas kabob", ru: "Тас-кебаб под соусом Бешамель", en: "Beşamel Soslu Tas Kebabı" }, weight: "400g", price: 98000, img: "Menyu/beshamel.png", quantity: 0 },
            { id: "89", cat: "yevropa", name: { uz: "Chokertme kabob", ru: "Чокертме-кебаб", en: "Çökertme Kebabı" }, weight: "400g", price: 95000, img: "Menyu/chokertme.png", quantity: 0 },
            { id: "90", cat: "yevropa", name: { uz: "Fettuccine alfredo", ru: "Фетучини Альфредо", en: "Fettuccine Alfredo" }, weight: "350g", price: 75800, img: "Menyu/Fettuccine_alfredo.png", quantity: 0 },
            { id: "91", cat: "yevropa", name: { uz: "Tovuq donar", ru: "Куринный донар", en: "Tavuk doner" }, weight: "350g", price: 42000, img: "Menyu/tovuq_donar.png", quantity: 0 },
            { id: "92", cat: "yevropa", name: { uz: "Qo'zi go'shti qovurmasi", ru: "Кавурма из ягненка", en: "Kuzu kavurma" }, weight: "350g", price: 108000, img: "Menyu/Qozi_goshti_qovurmasi.png", quantity: 0 },
            { id: "93", cat: "yevropa", name: { uz: "Tovuq lavash", ru: "Куриный лаваш", en: "Tavuk lavaş" }, weight: "350g", price: 37000, img: "Menyu/tovuq_lavash.png", quantity: 0 },
            { id: "94", cat: "yevropa", name: { uz: "Sousli Tire köftesi", ru: "Тире-кофта в соусе", en: "Soslu Tire Şiş Köfte" }, weight: "350g", price: 95000, img: "Menyu/sousli_tire_koftesi.png", quantity: 0 },
            { id: "95", cat: "yevropa", name: { uz: "Ali nazik", ru: "Али назик", en: "Ali nazik" }, weight: "350g", price: 98000, img: "Menyu/ali_nazik.png", quantity: 0 },
            { id: "96", cat: "yevropa", name: { uz: "Tandir beyti", ru: "Бейти-кебаб в духовке", en: "Fırın Beyti Sarma" }, weight: "350g", price: 85000, img: "Menyu/tandir_beyti.png", quantity: 0 },
            { id: "97", cat: "yevropa", name: { uz: "Mol go'shti qovurmasi", ru: "Кавурма из говядины", en: "Et kavurma" }, weight: "350g", price: 180000, img: "Menyu/mol_goshti_qovurmasi.png", quantity: 0 },
            { id: "98", cat: "yevropa", name: { uz: "Patnis kabobi", ru: "Тепси-кебаб", en: "Hatay Usulü Tepsi Kebabı" }, weight: "350g", price: 98000, img: "Menyu/patnis_kabobi.png", quantity: 0 },
            { id: "99", cat: "yevropa", name: { uz: "Go'shtli krep", ru: "Блинчики «Креп» с мясом", en: "Etli krep" }, weight: "300g", price: 103000, img: "Menyu/goshtli_krep.png", quantity: 0 },
            { id: "100", cat: "yevropa", name: { uz: "Ilikli Antep kabobi", ru: "Антеп-кебаб с костным мозгом", en: "İlikli Antep Kebabı" }, weight: "350g", price: 115000, img: "Menyu/ilikli_antep_kebabi.png", quantity: 0 },
            { id: "101", cat: "yevropa", name: { uz: "Sato biryon", ru: "Сато Бирян", en: "Sato Büryan" }, weight: "500g", price: 238000, img: "Menyu/santo_biryon.png", quantity: 0 },
            { id: "102", cat: "yevropa", name: { uz: "Qovurdog'", ru: "Кавурдак", en: "Kavurdak" }, weight: "350g", price: 98000, img: "Menyu/kavurdak.png", quantity: 0 },
            { id: "103", cat: "yevropa", name: { uz: "Brizol", ru: "Бризол", en: "Brizol" }, weight: "300g", price: 51500, img: "Menyu/brizol.png", quantity: 0 },
            { id: "104", cat: "yevropa", name: { uz: "Bifshteks", ru: "Бифштекс", en: "Bifstekts" }, weight: "250g", price: 44000, img: "Menyu/bifshtex.png", quantity: 0 },
            { id: "105", cat: "yevropa", name: { uz: "Gulyash", ru: "Гуляш", en: "Gulas" }, weight: "350g", price: 61000, img: "Menyu/gulas.png", quantity: 0 },
            { id: "106", cat: "yevropa", name: { uz: "Langet", ru: "Лангет", en: "Langet" }, weight: "250g", price: 52900, img: "Menyu/langet.png", quantity: 0 },

            // ========== TURKISH (107-128) ==========
            { id: "107", cat: "turkish", name: { uz: "Go'shtli sote", ru: "Мясное сате", en: "Et sote" }, weight: "350g", price: 69900, img: "Menyu/goshtli_sate.png", quantity: 0 },
            { id: "108", cat: "turkish", name: { uz: "Tovada tovuq", ru: "Куринный сачтава", en: "Tavuk sach tava" }, weight: "350g", price: 64500, img: "Menyu/tavada_tovuq.png", quantity: 0 },
            { id: "109", cat: "turkish", name: { uz: "Xitoycha go'sht", ru: "Мясо по-китайски", en: "Çin Usulü Et Sote" }, weight: "350g", price: 74900, img: "Menyu/xitoycha_gosht.png", quantity: 0 },
            { id: "110", cat: "turkish", name: { uz: "Tovada go'sht", ru: "Мясное сачтава", en: "Et sachtava" }, weight: "350g", price: 74800, img: "Menyu/tavada_gosht.png", quantity: 0 },
            { id: "111", cat: "turkish", name: { uz: "Qanotchalar", ru: "Крылышки", en: "Kanat" }, weight: "300g", price: 62000, img: "Menyu/qanotchalar.png", quantity: 0 },
            { id: "112", cat: "turkish", name: { uz: "Qo'zi pirzola", ru: "Баранья перзола", en: "Kuzu pirzola" }, weight: "300g", price: 108000, img: "Menyu/qazi_pirzola.png", quantity: 0 },
            { id: "113", cat: "turkish", name: { uz: "Kemiksis", ru: "Кемиксис", en: "Kemiksiz" }, weight: "300g", price: 71000, img: "Menyu/kemiksis.png", quantity: 0 },
            { id: "114", cat: "turkish", name: { uz: "Mak kabobi", ru: "Мак-кебаб", en: "Mak kebab" }, weight: "350g", price: 88000, img: "Menyu/makkabob.png", quantity: 0 },
            { id: "115", cat: "turkish", name: { uz: "Qo'y go'shtidan kabob", ru: "Кебаб мясное шиш", en: "Kebab etli sis" }, weight: "300g", price: 79000, img: "Menyu/qoy_goshtidan_kabob.png", quantity: 0 },
            { id: "116", cat: "turkish", name: { uz: "Mangal assorti", ru: "Мангал ассорти", en: "Mangal assorti" }, weight: "600g", price: 123000, img: "Menyu/mangal_assorti.png", quantity: 0 },
            { id: "117", cat: "turkish", name: { uz: "Tovuq go'shtidan kabob", ru: "Кебаб куринный шиш", en: "Tavuk kebab sis" }, weight: "300g", price: 69900, img: "Menyu/tovuq_goshtidan_kabob.png", quantity: 0 },
            { id: "118", cat: "turkish", name: { uz: "Tibon steyk", ru: "Тибон стейк", en: "Tibon steak" }, weight: "300g", price: 105000, img: "Menyu/tibon_steyk.png", quantity: 0 },
            { id: "119", cat: "turkish", name: { uz: "Dallas steyk", ru: "Даллас стейк", en: "Dallas steyk" }, weight: "300g", price: 110000, img: "Menyu/dallas steyk.png", quantity: 0 },
            { id: "120", cat: "turkish", name: { uz: "Urfa kabob", ru: "Урфа кебаб", en: "Urfa kebab" }, weight: "350g", price: 88000, img: "Menyu/urfa_kabob.png", quantity: 0 },
            { id: "121", cat: "turkish", name: { uz: "Medalyon steyk", ru: "Медальон стейк", en: "Medalion steak" }, weight: "250g", price: 134400, img: "Menyu/Medalyon_steyk.png", quantity: 0 },
            { id: "122", cat: "turkish", name: { uz: "Izgara kofte", ru: "Котлеты на гриле", en: "Izgara köfte" }, weight: "300g", price: 72000, img: "Menyu/izagara_kofte.png", quantity: 0 },
            { id: "123", cat: "turkish", name: { uz: "Go'sht assorti", ru: "Мясное ассорти", en: "Et assorti" }, weight: "500g", price: 140000, img: "Menyu/gosht _assorti.png", quantity: 0 },
            { id: "124", cat: "turkish", name: { uz: "Adana kabob", ru: "Адана кебаб", en: "Adana kebab" }, weight: "350g", price: 88000, img: "Menyu/adana_kabob.png", quantity: 0 },
            { id: "125", cat: "turkish", name: { uz: "Non (butun)", ru: "Хлеб (целый)", en: "Ekmek (tam)" }, weight: "200g", price: 6000, img: "Menyu/non.png", quantity: 0 },
            { id: "126", cat: "turkish", name: { uz: "Non (yarim)", ru: "Хлеб (половина)", en: "Ekmek (yarım)" }, weight: "100g", price: 3000, img: "Menyu/non.png", quantity: 0 },
            { id: "127", cat: "turkish", name: { uz: "Turkcha non", ru: "Турецкий хлеб", en: "Türk Ekmeği" }, weight: "150g", price: 5000, img: "Menyu/turkcha_non.png", quantity: 0 },
            { id: "128", cat: "turkish", name: { uz: "Afg'on non", ru: "Афганский хлеб", en: "Afgan Ekmeği" }, weight: "200g", price: 14500, img: "Menyu/afgon_non.png", quantity: 0 },

            // ========== FIRMINIY BLUDA (129-135) ==========
            { id: "129", cat: "firmali", name: { uz: "Qo'y bo'yni", ru: "Баранья шейка", en: "Kuzu Gerdan" }, weight: "300g", price: 319000, img: "Menyu/qoy_boyni.png", quantity: 0 },
            { id: "130", cat: "firmali", name: { uz: "Mangal assorti", ru: "Мангал ассорти", en: "Mangal assorti" }, weight: "600g", price: 638000, img: "Menyu/mangal_assorti_638.000.png", quantity: 0 },
            { id: "131", cat: "firmali", name: { uz: "Assorti uyg'ur + milliy 1+4", ru: "Ассорти уйгурское + национальное 1+4", en: "Assorti uyg'ur + milliy 1+4" }, weight: "700g", price: 613000, img: "Menyu/Assorti_uygur_+_milliy.png", quantity: 0 },
            { id: "132", cat: "firmali", name: { uz: "Qo'y kurak go'shti", ru: "Баранья лопатка", en: "Kuzu Kol" }, weight: "300g", price: 418000, img: "Menyu/qoy_kukrak_goshti.png", quantity: 0 },
            { id: "133", cat: "firmali", name: { uz: "Qo'y qovurg'asi", ru: "Баранья корейка", en: "Kuzu Pirzola" }, weight: "300g", price: 300000, img: "Menyu/qoy_qovurgasi.png", quantity: 0 },
            { id: "134", cat: "firmali", name: { uz: "Ahmadbek assorti", ru: "Ахмадбек ассорти", en: "Ahmadbek assorti" }, weight: "600g", price: 722200, img: "Menyu/ahmadbek_assorti.png", quantity: 0 },
            { id: "135", cat: "firmali", name: { uz: "Oshpazdan maxsus", ru: "Вырезка от шефа", en: "Şefin Özel Lokum Bonfilesi" }, weight: "300g", price: 328000, img: "Menyu/Oshpazdan_maxsus.png", quantity: 0 },

            // ========== PITSA PIDE (136-156) ==========
            { id: "136", cat: "pide", name: { uz: "Farshli pide", ru: "Пиде с фаршом", en: "Kiymali pide" }, weight: "300g", price: 65000, img: "Menyu/farshl_ pide.png", quantity: 0 },
            { id: "137", cat: "pide", name: { uz: "Laxmadjun", ru: "Лахмаджун", en: "Laxmadjun" }, weight: "250g", price: 48000, img: "Menyu/Laxmadjun.png", quantity: 0 },
            { id: "138", cat: "pide", name: { uz: "Kir pide", ru: "Кир пиде", en: "Kir pide" }, weight: "300g", price: 69400, img: "Menyu/kir_pide.png", quantity: 0 },
            { id: "139", cat: "pide", name: { uz: "Tuxumli pide", ru: "Пиде с яйцом", en: "Tulumli pide" }, weight: "300g", price: 52600, img: "Menyu/tuxumli pide.png", quantity: 0 },
            { id: "140", cat: "pide", name: { uz: "Go'shtli pide", ru: "Пиде с мясом", en: "Etli pide" }, weight: "350g", price: 85000, img: "Menyu/goshtli pide.png", quantity: 0 },
            { id: "141", cat: "pide", name: { uz: "Pishloqli pide", ru: "Пиде с сыром", en: "Kaşarlı Pide" }, weight: "300g", price: 51700, img: "Menyu/sirli pide.png", quantity: 0 },
            { id: "142", cat: "pide", name: { uz: "Assorti pide", ru: "Ассорти пиде", en: "Karışık Pide" }, weight: "350g", price: 90000, img: "Menyu/assorti_pide.png", quantity: 0 },
            { id: "143", cat: "pide", name: { uz: "Asalli pide", ru: "Пиде с мёдом", en: "Tatlı pide" }, weight: "300g", price: 54200, img: "Menyu/asalli_pide.png", quantity: 0 },
            { id: "144", cat: "pide", name: { uz: "Lavash", ru: "Лаваш", en: "Lavaş" }, weight: "300g", price: 36000, img: "Menyu/lavash.png", quantity: 0 },
            { id: "145", cat: "pide", name: { uz: "Tandir lavash", ru: "Тандыр лаваш", en: "Tandır Lavaş" }, weight: "300g", price: 38500, img: "Menyu/tandir lavash.png", quantity: 0 },
            { id: "146", cat: "pide", name: { uz: "Chizburger", ru: "Чизбургер", en: "Cheeseburger" }, weight: "250g", price: 35200, img: "Menyu/cheeseburger.png", quantity: 0 },
            { id: "147", cat: "pide", name: { uz: "Donar", ru: "Донер", en: "Doner" }, weight: "300g", price: 36300, img: "Menyu/donar.png", quantity: 0 },
            { id: "148", cat: "pide", name: { uz: "Gamburger", ru: "Гамбургер", en: "Hamburger" }, weight: "250g", price: 33000, img: "Menyu/gamburger.png", quantity: 0 },
            { id: "149", cat: "pide", name: { uz: "Kartoshka fri", ru: "Фри", en: "Fri" }, weight: "200g", price: 18200, img: "Menyu/fri.png", quantity: 0 },
            { id: "150", cat: "pide", name: { uz: "Kartosh derevenskiy", ru: "Картошка по деревенски", en: "Köy Usulü Patates" }, weight: "200g", price: 22500, img: "Menyu/Kartosh_derevenskiy.png", quantity: 0 },
            { id: "151", cat: "pide", name: { uz: "Guruch", ru: "Рис", en: "Guruc" }, weight: "200g", price: 9900, img: "Menyu/gurunch.png", quantity: 0 },
            { id: "152", cat: "pide", name: { uz: "Pyure", ru: "Пюре", en: "Püre" }, weight: "200g", price: 13500, img: "Menyu/pyure.png", quantity: 0 },
            { id: "153", cat: "pide", name: { uz: "Tushonka", ru: "Тушонка", en: "Stewed meat" }, weight: "300g", price: 70000, img: "Menyu/tushonka.png", quantity: 0 },
            { id: "154", cat: "pide", name: { uz: "Ispan", ru: "Испан", en: "Spanish Style Meat" }, weight: "250g", price: 76600, img: "Menyu/ispan.png", quantity: 0 },
            { id: "155", cat: "pide", name: { uz: "Semechki", ru: "Семечки", en: "Semechki" }, weight: "100g", price: 78000, img: "Menyu/semechka.png", quantity: 0 },
            { id: "156", cat: "pide", name: { uz: "Cho'poncha", ru: "Чупонча", en: "Cho'poncha" }, weight: "300g", price: 289000, img: "Menyu/choponcha.png", quantity: 0 },

            // ========== ICHIMLIKLAR (157-178) ==========
            { id: "157", cat: "ichimlik", name: { uz: "Ananasoviy", ru: "Ананасовый", en: "Pineapple" }, weight: "300ml", price: 21000, price2: 42000, img: "Menyu/mojito.png", quantity: 0 },
            { id: "158", cat: "ichimlik", name: { uz: "Okean", ru: "Океан", en: "Ocean" }, weight: "300ml", price: 21000, price2: 42000, img: "Menyu/mojito.png", quantity: 0 },
            { id: "159", cat: "ichimlik", name: { uz: "Mojito", ru: "Мохито", en: "Mojito" }, weight: "300ml", price: 23700, price2: 54000, img: "Menyu/mojito.png", quantity: 0 },
            { id: "160", cat: "ichimlik", name: { uz: "Mango", ru: "Манго", en: "Mango" }, weight: "300ml", price: 21000, price2: 42000, img: "Menyu/mojito.png", quantity: 0 },
            { id: "161", cat: "ichimlik", name: { uz: "Greypfrut", ru: "Грейпфрут", en: "Grapefruit" }, weight: "300ml", price: 21000, price2: 42000, img: "Menyu/mojito.png", quantity: 0 },
            { id: "162", cat: "ichimlik", name: { uz: "Yabloko kivi", ru: "Яблоко киви", en: "Apple kiwi" }, weight: "300ml", price: 21000, price2: 42000, img: "Menyu/mojito.png", quantity: 0 },
            { id: "163", cat: "ichimlik", name: { uz: "Tsitrusoviy", ru: "Цитрусовый", en: "Citrus" }, weight: "300ml", price: 21000, price2: 42000, img: "Menyu/mojito.png", quantity: 0 },
            { id: "164", cat: "ichimlik", name: { uz: "Tarxun", ru: "Тархун", en: "Tarragon" }, weight: "300ml", price: 21000, price2: 42000, img: "Menyu/mojito.png", quantity: 0 },
            { id: "165", cat: "ichimlik", name: { uz: "Dyushes", ru: "Дюшес", en: "Duchess" }, weight: "300ml", price: 21000, price2: 42000, img: "Menyu/mojito.png", quantity: 0 },
            { id: "166", cat: "ichimlik", name: { uz: "Aysti", ru: "Айс-ти", en: "Ice Tea" }, weight: "300ml", price: 21000, price2: 42000, img: "Menyu/mojito.png", quantity: 0 },
            { id: "167", cat: "ichimlik", name: { uz: "Klubnichniy", ru: "Клубничный", en: "Strawberry" }, weight: "300ml", price: 21000, price2: 42000, img: "Menyu/mojito.png", quantity: 0 },
            { id: "168", cat: "ichimlik", name: { uz: "Banan ananas", ru: "Банан ананас", en: "Banana pineapple" }, weight: "300ml", price: 30000, price2: 46000, img: "Menyu/mojito.png", quantity: 0 },
            { id: "169", cat: "ichimlik", name: { uz: "Choy Imbir", ru: "Имбирный чай", en: "Ginger Tea" }, weight: "250ml", price: 34500, img: "Menyu/Imbir choy.png", quantity: 0 },
            { id: "170", cat: "ichimlik", name: { uz: "Choy Fruktoviy", ru: "Фруктовый чай", en: "Fruit Tea" }, weight: "250ml", price: 34500, img: "Menyu/Choy Fruktoviy.png", quantity: 0 },
            { id: "171", cat: "ichimlik", name: { uz: "Choy Marokanskiy", ru: "Марокканский чай", en: "Moroccan Tea" }, weight: "250ml", price: 34500, img: "Menyu/Choy Marokanskiy.png", quantity: 0 },
            { id: "172", cat: "ichimlik", name: { uz: "Choy Karkade", ru: "Чай Каркаде", en: "Hibiscus Tea" }, weight: "250ml", price: 34500, img: "Menyu/Choy Karkade.png", quantity: 0 },
            { id: "173", cat: "ichimlik", name: { uz: "Apelsin sharbati", ru: "Апельсиновый сок", en: "Orange Juice" }, weight: "300ml", price: 50600, img: "Menyu/Apelsin_sharbati.png", quantity: 0 },
            { id: "174", cat: "ichimlik", name: { uz: "Olma sharbati", ru: "Яблочный сок", en: "Apple Juice" }, weight: "300ml", price: 37000, img: "Menyu/olma sharbati.png", quantity: 0 },
            { id: "175", cat: "ichimlik", name: { uz: "Choy Shipovnik", ru: "Чай из шиповника", en: "Rosehip Tea" }, weight: "250ml", price: 34500, img: "Menyu/Choynik Choy.png", quantity: 0 },
            { id: "176", cat: "ichimlik", name: { uz: "Choy Yagodny", ru: "Ягодный чай", en: "Berry Tea" }, weight: "250ml", price: 34500, img: "Menyu/Choy Yagodny.png", quantity: 0 },
            { id: "177", cat: "ichimlik", name: { uz: "Bardak choy", ru: "Чай в армуду (стакан)", en: "Bardak Çay" }, weight: "150ml", price: 4500, img: "Menyu/Bardak choy.png", quantity: 0 },
            { id: "178", cat: "ichimlik", name: { uz: "Choynik choy", ru: "Чай в чайнике", en: "Teapot Tea" }, weight: "500ml", price: 29000, img: "Menyu/Choynik Choy.png", quantity: 0 },

            // ========== SHIRINLIKLAR (179-190) ==========
            { id: "179", cat: "shirinlik", name: { uz: "Napoleon", ru: "Наполеон", en: "Napoleon" }, weight: "150g", price: 26500, img: "Menyu/napoleon.png", quantity: 0 },
            { id: "180", cat: "shirinlik", name: { uz: "Tvorojniy", ru: "Творожный", en: "Cheesecake" }, weight: "150g", price: 26500, img: "Menyu/cheesecake.png", quantity: 0 },
            { id: "181", cat: "shirinlik", name: { uz: "Sultan", ru: "Султан", en: "Sultan" }, weight: "150g", price: 26500, img: "Menyu/sultan.png", quantity: 0 },
            { id: "182", cat: "shirinlik", name: { uz: "Prichuda", ru: "Причуда", en: "Prichuda" }, weight: "150g", price: 26500, img: "Menyu/prichuda.png", quantity: 0 },
            { id: "183", cat: "shirinlik", name: { uz: "Malinoviy", ru: "Малиновый", en: "Raspberry cake" }, weight: "150g", price: 26500, img: "Menyu/raspberry-cake.png", quantity: 0 },
            { id: "184", cat: "shirinlik", name: { uz: "Snikers", ru: "Сникерс", en: "Snickers" }, weight: "150g", price: 26500, img: "Menyu/snickers.png", quantity: 0 },
            { id: "185", cat: "shirinlik", name: { uz: "Sirniy", ru: "Сырный", en: "Cheese cake" }, weight: "150g", price: 26500, img: "Menyu/chees.png", quantity: 0 },
            { id: "186", cat: "shirinlik", name: { uz: "Desert fruktoviy", ru: "Десерт фруктовый", en: "Fruit dessert" }, weight: "200g", price: 30000, img: "Menyu/Desert_fruktoviy.png", quantity: 0 },
            { id: "187", cat: "shirinlik", name: { uz: "Vafli", ru: "Вафли", en: "Waffles" }, weight: "150g", price: 36000, img: "Menyu/vafli.png", quantity: 0 },
            { id: "188", cat: "shirinlik", name: { uz: "Pista (1 dona)", ru: "Фисташки (1 порция)", en: "Pistachio" }, weight: { uz: "1 kg", ru: "1 кг", en: "1 kg" }, price: 30000, img: "Menyu/pista.jpg", quantity: 0 },
            { id: "189", cat: "shirinlik", name: { uz: "Bodom (1 dona)", ru: "Миндаль (1 порция)", en: "Almond" }, weight: { uz: "1 kg", ru: "1 кг", en: "1 kg" }, price: 23000, img: "Menyu/bodom.jpg", quantity: 0 },
            { id: "190", cat: "shirinlik", name: { uz: "Konfet (1 dona)", ru: "Конфеты (1 порция)", en: "Candy / Sweets" }, weight: { uz: "1 kg", ru: "1 кг", en: "1 kg" }, price: 23200, img: "Menyu/konfet.jpg", quantity: 0 }
        ];

        const savedProducts = readJSONFromLocalStorage('products');

        function migrateDrinkAltPrices(list) {
            if (!Array.isArray(list)) return false;
            const map = {
                "157": { price: 21000, price2: 42000 },
                "158": { price: 21000, price2: 42000 },
                "159": { price: 23700, price2: 54000 },
                "160": { price: 21000, price2: 42000 },
                "161": { price: 21000, price2: 42000 },
                "162": { price: 21000, price2: 42000 },
                "163": { price: 21000, price2: 42000 },
                "164": { price: 21000, price2: 42000 },
                "165": { price: 21000, price2: 42000 },
                "166": { price: 21000, price2: 42000 },
                "167": { price: 21000, price2: 42000 },
                "168": { price: 30000, price2: 46000 }
            };
            let changed = false;
            list.forEach(p => {
                const rec = map[String(p?.id || '')];
                if (!rec) return;
                if (!Number.isFinite(Number(p.price)) || Number(p.price) !== rec.price) {
                    p.price = rec.price;
                    changed = true;
                }
                if (!Number.isFinite(Number(p.price2)) || Number(p.price2) !== rec.price2) {
                    p.price2 = rec.price2;
                    changed = true;
                }
            });
            return changed;
        }

        function migrateProductWeights(list) {
            if (!Array.isArray(list)) return false;
            let changed = false;
            list.forEach((p) => {
                if (!p) return;
                const normalized = normalizeProductWeight(p.weight);
                if (JSON.stringify(p.weight) === JSON.stringify(normalized)) return;
                p.weight = normalized;
                changed = true;
            });
            return changed;
        }

        function migrateNutWeights(list) {
            if (!Array.isArray(list)) return false;
            const targetIds = new Set(['188', '189', '190']);
            let changed = false;
            list.forEach((p) => {
                if (!p || !targetIds.has(String(p.id))) return;
                const targetWeight = { uz: '1 kg', ru: '1 кг', en: '1 kg' };
                if (JSON.stringify(normalizeProductWeight(p.weight)) === JSON.stringify(targetWeight)) return;
                p.weight = targetWeight;
                changed = true;
            });
            return changed;
        }

        if (Array.isArray(savedProducts)) products = cloneProductsForStorage(savedProducts);
        else {
            products = cloneProductsForStorage(defaultProducts);
            localStorage.setItem('products', JSON.stringify(products));
        }
        const didMigrateDrinkPrices = migrateDrinkAltPrices(products);
        const didMigrateProductWeights = migrateProductWeights(products);
        const didMigrateNutWeights = migrateNutWeights(products);
        if (didMigrateDrinkPrices || didMigrateProductWeights || didMigrateNutWeights) localStorage.setItem('products', JSON.stringify(products));
        // ==================== ASOSIY FUNKSIYALAR ====================
        function toggleRoomsPanel() {
            let p = document.getElementById('roomsPanel');
            p.classList.toggle('active');
            if (p.classList.contains('active')) {
                displayRooms();
                document.getElementById('roomsBookingForm').style.display = 'none';
            }
        }

	        function toggleMyOrdersPanel() {
	            const d = langData[currentLang];
	            if (!currentUser) {
	                closeAllUiOverlays();
	                openProfileDropdown();
	                alert(d.loginRequiredOrdersText);
	                return;
	            }
	            document.getElementById('myOrdersPanel').classList.toggle('active');
	            if (document.getElementById('myOrdersPanel').classList.contains('active')) displayMyOrders();
	        }

        let adminPanelAltShiftAEnabled = false;

        function toggleAdminPanel() {
            document.getElementById('adminPanel').classList.toggle('active');
        }

        function armAdminPanelHotkey(event) {
            event?.stopPropagation();
            adminPanelAltShiftAEnabled = true;
        }

        function setAddressError(message = '') {
            const addressError = document.getElementById('addressError');
            const addressInput = document.getElementById('addressInput');
            if (!addressError || !addressInput) return;

            const hasError = Boolean(message);
            addressError.textContent = message;
            addressError.style.display = hasError ? 'block' : 'none';
            addressInput.style.borderColor = hasError ? 'var(--danger)' : 'var(--primary)';
        }

        function validateAddress(showError = true) {
            const d = langData[currentLang] || langData.uz;
            const addressInput = document.getElementById('addressInput');
            const courierSelected = document.getElementById('courierDelivery')?.checked;
            if (!addressInput || !courierSelected) {
                if (showError) setAddressError('');
                return true;
            }

            const rawValue = addressInput.value || '';
            const trimmedValue = rawValue.trim();
            const hasOnlyPrefix = trimmedValue === ADDRESS_PREFIX.trim();
            const isTooShort = trimmedValue.length < MIN_ADDRESS_LENGTH;
            let errorMessage = '';

            if (!trimmedValue || hasOnlyPrefix) {
                errorMessage = d.addressRequiredError || "Iltimos, manzilingizni kiriting";
            } else if (isTooShort) {
                errorMessage = d.addressLengthError || "Manzil kamida 18 ta belgidan iborat bo'lishi kerak";
            }

            if (showError) setAddressError(errorMessage);
            return !errorMessage;
        }

        function togglePanel(id) {
            let p = document.getElementById(id);
            p.classList.toggle('active');
            if (id === 'cartPanel' && currentStep === 'checkout')
                showCart();
        }

        function toggleAbout(show) {
            document.getElementById('aboutModal').style.display = show ? 'flex' : 'none';
        }

        function toggleMobileMenu() {
            let m = document.getElementById('mobileMenu'),
                o = document.getElementById('mobileMenuOverlay'),
                h = document.getElementById('hamburgerMenu');
            m.classList.toggle('active');
            o.classList.toggle('active');
            h.classList.toggle('active');
            updateMobileBadges();
        }

        function closeMobileMenu() {
            document.getElementById('mobileMenu').classList.remove('active');
            document.getElementById('mobileMenuOverlay').classList.remove('active');
            document.getElementById('hamburgerMenu').classList.remove('active');
        }

        function scrollToTop() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function updateMobileBadges() {
            let ob = document.getElementById('mobileOrdersBadge'),
                rb = document.getElementById('mobileRoomsBadge'),
                cb = document.getElementById('mobileCartBadge');
            if (ob) ob.innerText = document.getElementById('myOrdersCount')?.innerText || '0';
            if (rb) rb.innerText = document.getElementById('roomsCount')?.innerText || '0/15';
            if (cb) cb.innerText = document.getElementById('cartCount')?.innerText || '0';
        }

        function displayRooms() {
            pruneExpiredBookings();
            const d = langData[currentLang];
            const grid = document.getElementById('roomsGrid');
            const adminGrid = document.getElementById('adminRoomsGrid');
            const publicBookingsEl = document.getElementById('roomsBookingsPublic');
            const adminBookingsEl = document.getElementById('adminRoomBookingsList');
            const today = getTodayDate();
            const nowMinutes = getCurrentMinutes();
            const activeRooms = rooms.filter(room =>
                room.bookings.some(b => b.date === today && nowMinutes >= b.cleaningStartMin && nowMinutes < b.cleaningEndMin)
            ).length;
            const roomsCountEl = document.getElementById('roomsCount');
            if (roomsCountEl) roomsCountEl.innerText = `${activeRooms}/${ROOM_COUNT}`;
            const totalRoomsStat = document.getElementById('totalRoomsStat');
            if (totalRoomsStat) totalRoomsStat.innerText = `${activeRooms}/${ROOM_COUNT}`;

            if (publicBookingsEl) {
                const allBookings = [];
                rooms.forEach(room => {
                    room.bookings.forEach(booking => {
                        allBookings.push({
                            roomNumber: room.number,
                            date: booking.date,
                            startTime: booking.startTime,
                            endTime: booking.endTime
                        });
                    });
                });
                allBookings.sort((a, b) => {
                    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
                    return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
                });
                if (allBookings.length === 0) {
                    publicBookingsEl.innerHTML = `<div class="admin-info-box">${d.roomsBookedListEmpty}</div>`;
                } else {
                    publicBookingsEl.innerHTML = `
                        <div style="font-weight: 800; color: var(--primary); margin-bottom: 10px;">${d.roomsBookedListTitle}</div>
                        <div style="display:flex;flex-direction:column;gap:10px;">
                            ${allBookings.map(b => `
                                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(74,144,226,0.2); border-radius: 12px; padding: 12px;">
                                    <div style="font-weight:800; color: var(--primary);">Xona ${b.roomNumber}</div>
                                    <div style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">${formatDisplayDate(b.date)} ${b.startTime}-${b.endTime}</div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                }
            }

            if (grid) {
                let html = '';
                rooms.forEach(room => {
                    const activeBooking = room.bookings.find(b => b.date === today && nowMinutes >= b.cleaningStartMin && nowMinutes < b.cleaningEndMin);
                    const hasActive = Boolean(activeBooking);
                    const nextBooking = getNextBooking(room);
                    const hasBookingToday = room.bookings.some(b => b.date === today);
                    const nextBookingToday = getNextBookingForDate(room, today);

                    const status = (hasActive || hasBookingToday) ? 'booked' : 'available';
                    const statusText = status === 'booked' ? d.roomBooked : d.roomAvailable;

                    let statusDetail = '';
                    if (hasActive) statusDetail = `${d.roomTempBooked} (${activeBooking.startTime}-${activeBooking.endTime})`;
                    else if (hasBookingToday && nextBookingToday) statusDetail = `${d.roomTempBooked} (${nextBookingToday.startTime}-${nextBookingToday.endTime})`;

                    const tooltip = nextBooking ? `${formatDisplayDate(nextBooking.date)} ${nextBooking.startTime}-${nextBooking.endTime}` : '';
                    html += `<div class="room-card ${status}" onclick="showRoomBookingForm(${room.id})" title="${tooltip}">
                                <div class="room-number">${room.number}</div>
                                <div class="room-status ${status}">${statusText}</div>
                                ${statusDetail ? `<div class="room-status-detail">${statusDetail}</div>` : ''}
                                ${nextBooking ? `<div class="room-time">${formatDisplayDate(nextBooking.date)} ${nextBooking.startTime}-${nextBooking.endTime}</div>` : ''}
                            </div>`;
                });
                grid.innerHTML = html;
            }

            if (adminGrid) {
                let adminHtml = '';
                rooms.forEach(room => {
                    const bookings = room.bookings.slice().sort((a, b) => {
                        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
                        return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
                    });
                    const todayBooking = getNextBookingForDate(room, today);
                    const detailText = todayBooking ? `Keyingi ${formatDisplayDate(todayBooking.date)} ${todayBooking.startTime}-${todayBooking.endTime}` : "";
                    adminHtml += `<div class="room-card ${bookings.length ? 'booked' : 'available'}">
                                    <div class="room-number">${room.number}</div>
                                    <div class="room-status ${bookings.length ? 'booked' : 'available'}">${bookings.length ? d.roomBooked : d.roomAvailable}</div>
                                    <div class="room-status-detail">${detailText}</div>
                                    ${bookings.map(booking => `<div class="room-time">${formatDisplayDate(booking.date)} ${booking.startTime}-${booking.endTime}</div>
                                        <button class="delete-btn" style="margin-top:10px; padding:5px;" onclick="adminCancelBooking(${room.id}, '${booking.id}')">${d.roomReleaseButton}</button>`).join('')}
                                </div>`;
                });
                adminGrid.innerHTML = adminHtml;
            }

            if (adminBookingsEl) {
                const allBookings = [];
                rooms.forEach(room => {
                    room.bookings.forEach(booking => {
                        allBookings.push({
                            roomId: room.id,
                            roomNumber: room.number,
                            id: booking.id,
                            date: booking.date,
                            startTime: booking.startTime,
                            endTime: booking.endTime,
                            name: booking.name || '',
                            phone: booking.phone || ''
                        });
                    });
                });
                allBookings.sort((a, b) => {
                    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
                    if (a.roomNumber !== b.roomNumber) return a.roomNumber - b.roomNumber;
                    return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
                });
                if (allBookings.length === 0) {
                    adminBookingsEl.innerHTML = `<div class="admin-info-box">Hozircha xona buyurtmalari yo'q.</div>`;
                } else {
                    adminBookingsEl.innerHTML = `
                        <table class="orders-table" style="margin-top: 10px;">
                            <thead>
                                <tr>
                                    <th>Xona</th>
                                    <th>Kuni</th>
                                    <th>Vaqt</th>
                                    <th>Ism</th>
                                    <th>Telefon</th>
                                    <th>Amal</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${allBookings.map(b => `
                                    <tr>
                                        <td>${b.roomNumber}</td>
                                        <td>${formatDisplayDate(b.date)}</td>
                                        <td>${b.startTime}-${b.endTime}</td>
                                        <td>${escapeHtml(b.name)}</td>
                                        <td>${escapeHtml(b.phone)}</td>
                                        <td><button class="delete-order-btn" onclick="adminCancelBooking(${b.roomId}, '${b.id}')">${d.roomReleaseButton}</button></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `;
                }
            }

            populateRoomSelector();
            refreshRoomConflictHint();
        }

	        function showRoomBookingForm(roomId) {
	            const d = langData[currentLang];
	            if (!currentUser) {
	                alert(d.roomBookingLoginMsg);
	                closeAllUiOverlays();
	                openProfileDropdown();
	                return;
	            }
	            selectedRoomId = roomId;
            const nameInput = document.getElementById('roomName');
            const phoneInput = document.getElementById('roomPhone');
            if (nameInput) nameInput.value = currentUser.name || '';
            if (phoneInput) {
                phoneInput.value = currentUser.phone || '+998 ';
                formatPhoneNumber(phoneInput);
            }
            updateRoomDateToToday();
            const startInput = document.getElementById('roomStartTime');
            const endInput = document.getElementById('roomEndTime');
            if (startInput) startInput.value = '13:00';
            if (endInput) endInput.value = '15:00';
            populateRoomSelector();
            document.getElementById('roomsBookingForm').style.display = 'block';
            refreshRoomConflictHint();
        }

        async function bookRoom() {
            if (!currentUser || !selectedRoomId) return;
            const d = langData[currentLang];
            const nameInput = document.getElementById('roomName');
            const phoneInput = document.getElementById('roomPhone');
            const dateInput = document.getElementById('roomDate');
            const startInput = document.getElementById('roomStartTime');
            const endInput = document.getElementById('roomEndTime');
            const name = nameInput?.value.trim() || currentUser.name || '';
            if (phoneInput) formatPhoneNumber(phoneInput);
            const phone = phoneInput?.value.trim() || '';
            const date = dateInput?.value || getTodayDate();
            const startTime = startInput?.value;
            const endTime = endInput?.value;

            if (!name) { alert(d.roomBookingNameRequired); return; }
            if (!date) { alert(d.roomBookingDateRequired); return; }
            if (!startTime || !endTime) { alert(d.roomBookingTimeOrderMsg); return; }
            if (startTime >= endTime) { alert(d.roomBookingTimeOrderMsg); return; }
            if (!isValidUzbekPhone(phone)) { alert(d.roomBookingPhoneInvalid); return; }

            const startMinutes = timeToMinutes(startTime);
            const endMinutes = timeToMinutes(endTime);
            if (startMinutes < ROOM_OPEN_HOUR * 60 || endMinutes > ROOM_CLOSE_HOUR * 60) {
                alert(d.roomBookingTimeRangeMsg);
                return;
            }

            const room = rooms.find(r => r.id === selectedRoomId);
            if (!room) return;
            const requestStart = startMinutes - ROOM_CLEANING_BUFFER;
            const requestEnd = endMinutes + ROOM_CLEANING_BUFFER;
            const conflict = findConflictingBooking(room, date, requestStart, requestEnd);
            if (conflict) {
                alert(`${d.roomBookingConflictPrefix} ${formatDisplayDate(conflict.date)} ${conflict.startTime}-${conflict.endTime}. ${d.roomBookingConflictCleaning} ${d.roomBookingConflictNextAvailable.replace('{time}', conflict.cleaningEnd)}.`);
                refreshRoomConflictHint();
                return;
            }

            const booking = normalizeBooking({
                date,
                startTime,
                endTime,
                userId: currentUser.id,
                name,
                phone,
                createdAt: new Date().toISOString()
            });
            if (!booking) return;
            try {
                const data = await safeApiRequest(`/api/rooms/${selectedRoomId}/bookings`, {
                    method: 'POST',
                    body: { booking }
                });
                rooms = normalizeRooms(data.rooms);
                localStorage.setItem('rooms', JSON.stringify(rooms));
            } catch (error) {
                room.bookings.push(booking);
                localStorage.setItem('rooms', JSON.stringify(rooms));
            }
            displayRooms();
            document.getElementById('roomsBookingForm').style.display = 'none';
            alert(`${d.roomBookingSuccess} ${room.number}`);

            const message = `🏨 YANGI XONA BAND QILINDI

🚪 Xona: ${room.number}
👤 Ism: ${booking.name || '—'}
📞 Telefon: ${booking.phone}
📅 Kun: ${formatDisplayDate(booking.date)}
            ⏰ Vaqt: ${booking.startTime} - ${booking.endTime}`;
            await sendTelegramMessage(message);
        }
        async function adminCancelBooking(roomId, bookingId) {
            const room = rooms.find(r => r.id === roomId);
            if (!room) return;
            try {
                const data = await safeApiRequest(`/api/rooms/${roomId}/bookings/${encodeURIComponent(bookingId)}`, {
                    method: 'DELETE'
                });
                rooms = normalizeRooms(data.rooms);
            } catch (error) {
                room.bookings = room.bookings.filter(b => b.id !== bookingId);
            }
            localStorage.setItem('rooms', JSON.stringify(rooms));
            displayRooms();
        }

        // Xona vaqtini tekshirish (har daqiqada)
        setInterval(() => {
            if (pruneExpiredBookings()) displayRooms();
        }, 60000);

        function displayMyOrders() {
            const d = langData[currentLang];
            const list = document.getElementById('myOrdersList');
            const loginRequired = document.getElementById('loginRequiredOrders');
            if (!currentUser) {
                loginRequired.style.display = 'block';
                list.innerHTML = '';
                return;
            }
            loginRequired.style.display = 'none';
            const userOrders = orders.filter(o => o.userId === currentUser.id).reverse();
            document.getElementById('myOrdersCount').innerText = userOrders.length;
            if (userOrders.length === 0) {
                list.innerHTML = `<div style="text-align:center;padding:30px;">${d.noOrdersYet}</div>`;
                return;
            }
            let html = '';
            userOrders.forEach(order => {
                let statusText = '';
                if (order.status === 'preparing') statusText = d.orderStatusPreparing;
                else if (order.courier && order.status === 'courier') statusText = d.orderStatusCourier;
                else if (!order.courier && order.status === 'ready') statusText = d.orderStatusReady;
                else if (!order.courier) statusText = d.orderStatusTakeaway;
                else statusText = d.orderStatusCourier;
                html += `<div class="order-card">
                        <div class="order-header">
                            <span class="order-id">#${String(order.id).padStart(6, '0')}</span>
                            <span class="order-status">${statusText}</span>
                        </div>
                        <div class="order-items">${order.items.map(item => `${item.name} x${item.quantity}`).join(', ')}</div>
                        <div style="margin-top:8px;color:var(--primary);">${d.totalText} ${order.total.toLocaleString()} ${d.currencySymbol}</div>
                    </div>`;
            });
            list.innerHTML = html;
        }
        function displayProducts(category = 'all') {
            const d = langData[currentLang];
            currentCategory = category;
            const grid = document.getElementById('menuGrid');
            grid.innerHTML = '';
            const categories = ['salat', 'milliy', 'yevropa', 'turkish', 'firmali', 'pide', 'ichimlik', 'shirinlik'];
            const categoryNames = { salat: d.salat, milliy: d.milliy, yevropa: d.yevropa, turkish: d.turkish, firmali: d.firmali, pide: d.pide, ichimlik: d.ichimlik, shirinlik: d.shirinlik };
            const categoryIcons = { salat: '🥗', milliy: '🍲', yevropa: '🍝', turkish: '🍖', firmali: '👑', pide: '🍕', ichimlik: '🥤', shirinlik: '🍰' };

            let filtered = products;
            if (category !== 'all') filtered = filtered.filter(p => p.cat === category);
            if (searchQuery) filtered = filtered.filter(p => (p.name[currentLang] || p.name.uz || p.name).toLowerCase().includes(searchQuery));

            document.getElementById('searchResultCount').innerText = filtered.length;
            if (filtered.length === 0 && searchQuery) {
                grid.innerHTML = `<div class="no-results">🔍 ${d.noResults}</div>`;
                return;
            }

            categories.forEach(cat => {
                const catProducts = filtered.filter(p => p.cat === cat);
                if (catProducts.length > 0) {
                    let catHtml = `<div class="category-section"><h2 class="category-title">${categoryIcons[cat]} ${categoryNames[cat]}</h2><div class="category-products">`;
                    catProducts.forEach(p => {
                        const currentName = p.name[currentLang] || p.name.uz || p.name;
                        const imgCandidates = getProductImageCandidates(p);
                        const imgFallbacks = encodeURIComponent(JSON.stringify(imgCandidates));
                        const priceText = formatProductPriceText(p, d);
                        const isPriorityImage = category === 'all' ? filtered.indexOf(p) < 6 : catProducts.indexOf(p) < 4;
                        catHtml += `<div class="card" id="card-${p.id}">
                                    <button class="goto-btn" onclick="goToProduct('${p.id}')"><i class="fas fa-arrow-right"></i></button>
                                    <img src="${imgCandidates[0]}" data-fallbacks="${imgFallbacks}" data-fallback-index="0" onerror="handleProductImgError(this)" loading="${isPriorityImage ? 'eager' : 'lazy'}" decoding="async" fetchpriority="${isPriorityImage ? 'high' : 'low'}" alt="${escapeHtml(currentName)}">
                                    <h3>${currentName}</h3>
                                    <div class="product-weight">${getLocalizedWeightText(p.weight, currentLang)}</div>
                                    <div class="price">${priceText}</div>
                                    <div class="quantity-controls">
                                        <button class="qty-btn minus" onclick="decreaseQuantity('${p.id}')">−</button>
                                        <span class="qty-value" id="qty-${p.id}">${p.quantity}</span>
                                        <button class="qty-btn plus" onclick="increaseQuantity('${p.id}')">+</button>
                                    </div>
                                </div>`;
                    });
                    catHtml += `</div></div>`;
                    grid.innerHTML += catHtml;
                }
            });

            if (scrollObserver) scrollObserver.disconnect();
            scrollObserver = new IntersectionObserver((entries) => {
                entries.forEach(e => {
                    if (e.isIntersecting) {
                        e.target.classList.add('revealed');
                        scrollObserver.unobserve(e.target);
                    }
                });
            }, { threshold: 0.05 });
            document.querySelectorAll('.category-section').forEach(s => scrollObserver.observe(s));
            warmProductImages(grid);
        }

	        function increaseQuantity(productId) {
	            const d = langData[currentLang];
	            if (!currentUser) {
	                closeAllUiOverlays();
	                openProfileDropdown();
	                alert(d.loginRequiredMessageText);
	                return;
	            }
            const userData = currentUser;
            if (userData && userData.blocked) { alert("Akkaunt bloklangan!"); return; }
            const product = products.find(p => p.id === productId);
            if (product) {
                const currentTotal = cart.reduce((sum, item) => sum + item.quantity, 0);
                const maxOrder = userData?.maxOrder || 100;
                if (currentTotal >= maxOrder) {
                    alert(`⚠️ ${d.maxOrderText}${maxOrder}${d.maxOrderUnit}!`);
                    return;
                }
                product.quantity++;
                document.getElementById(`qty-${productId}`).textContent = product.quantity;
                const cartItem = cart.find(item => item.id === productId);
                if (cartItem) cartItem.quantity = product.quantity;
                else cart.push({ id: product.id, name: product.name, price: product.price, weight: normalizeProductWeight(product.weight), quantity: product.quantity });
                updateCart();
                const productName = product.name[currentLang] || product.name.uz || product.name;
                showNotification(d.notificationProductAdded, `${productName} ${d.productAddedMsg}`, 'success');
            }
        }

        function decreaseQuantity(productId) {
            const d = langData[currentLang];
            const product = products.find(p => p.id === productId);
            if (product && product.quantity > 0) {
                product.quantity--;
                document.getElementById(`qty-${productId}`).textContent = product.quantity;
                const cartIndex = cart.findIndex(item => item.id === productId);
                if (cartIndex !== -1) {
                    if (product.quantity === 0) cart.splice(cartIndex, 1);
                    else cart[cartIndex].quantity = product.quantity;
                }
                updateCart();
                if (product.quantity === 0) {
                    const productName = product.name[currentLang] || product.name.uz || product.name;
                    showNotification(d.notificationProductRemoved, `${productName} ${d.productRemovedMsg}`, 'danger');
                }
            }
        }

        function updateCart() {
            const d = langData[currentLang];
            const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
            document.getElementById('cartCount').innerText = totalItems;
            const list = document.getElementById('cartList');
            list.innerHTML = '';
            let total = 0;
            cart.forEach(item => {
                const itemTotal = item.price * item.quantity;
                total += itemTotal;
                const currentName = item.name[currentLang] || item.name.uz || item.name;
                list.innerHTML += `<div style="display:flex;justify-content:space-between;margin-bottom:15px;border-bottom:1px solid rgba(74,144,226,0.2);padding-bottom:10px;">
                                    <div>
                                        <b>${currentName}</b>
                                        <div style="font-size:12px;">${getLocalizedWeightText(item.weight, currentLang)} | ${item.price.toLocaleString()} ${d.currency}</div>
                                    </div>
                                    <div>
                                        <div style="display:flex;gap:5px;">
                                            <button class="nav-btn" style="padding:5px 10px;" onclick="decreaseQuantity('${item.id}')">−</button>
                                            <input type="number" class="quantity-input" value="${item.quantity}" min="0" onchange="setQuantity('${item.id}',this)" style="width:50px;">
                                            <button class="nav-btn" style="padding:5px 10px;background:var(--primary);" onclick="increaseQuantity('${item.id}')">+</button>
                                        </div>
                                        <div style="text-align:right;margin-top:5px;"><b>${itemTotal.toLocaleString()} ${d.currency}</b></div>
                                    </div>
                                </div>`;
            });
            const courierChecked = document.getElementById('courierDelivery')?.checked || false;
            if (courierChecked && cart.length > 0) {
                list.innerHTML += `<div style="display:flex;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:2px dashed var(--courier);color:var(--courier);">
                                    <span>🚚 ${d.courierLabel.replace('🚚 ', '')}</span>
                                    <span>+${COURIER_PRICE.toLocaleString()} ${d.currency}</span>
                                </div>`;
                total += COURIER_PRICE;
            }
            document.getElementById('totalPrice').innerText = total.toLocaleString();
            saveCartState();
        }

        function saveCartState() {
            try {
                const courierChecked = document.getElementById('courierDelivery')?.checked || false;
                const items = cart.map(i => ({ id: i.id, quantity: i.quantity }));
                localStorage.setItem('cartState', JSON.stringify({ courier: courierChecked, items }));
            } catch (e) {
                // Ignore storage quota / JSON errors.
            }
        }

        function loadCartState() {
            const state = readJSONFromLocalStorage('cartState');
            if (!state || !Array.isArray(state.items)) return;
            cart = [];
            // Reset quantities first to avoid stale values.
            products.forEach(p => { p.quantity = 0; });
            state.items.forEach(item => {
                const product = products.find(p => p.id === item.id);
                const qty = parseInt(item.quantity, 10);
                if (!product || !isFinite(qty) || qty <= 0) return;
                product.quantity = qty;
                cart.push({ id: product.id, name: product.name, price: product.price, weight: normalizeProductWeight(product.weight), quantity: qty });
            });
            const courier = document.getElementById('courierDelivery');
            if (courier) courier.checked = Boolean(state.courier);
        }

        function setQuantity(productId, input) {
            const d = langData[currentLang];
            if (!currentUser) { alert("Avval kiring!"); toggleProfileDropdown(); return; }
            let value = parseInt(input.value);
            const product = products.find(p => p.id === productId);
            if (isNaN(value) || value < 0) value = 0;
            const maxOrder = currentUser?.maxOrder || 100;
            if (value > maxOrder) value = maxOrder;
            const oldQuantity = product.quantity;
            product.quantity = value;
            document.getElementById(`qty-${productId}`).textContent = value;
            if (value > 0) {
                const cartItem = cart.find(item => item.id === productId);
                if (cartItem) cartItem.quantity = value;
                else cart.push({ id: product.id, name: product.name, price: product.price, weight: normalizeProductWeight(product.weight), quantity: value });
            } else {
                const idx = cart.findIndex(item => item.id === productId);
                if (idx !== -1) cart.splice(idx, 1);
            }
            updateCart();
            const productName = product.name[currentLang] || product.name.uz || product.name;
            if (oldQuantity === 0 && value > 0)
                showNotification(d.notificationProductAdded, `${productName} ${d.productAddedMsg}`, 'success');
            else if (oldQuantity > 0 && value === 0)
                showNotification(d.notificationProductRemoved, `${productName} ${d.productRemovedMsg}`, 'danger');
        }
	        function showCheckout() {
	            const d = langData[currentLang];
	            if (!currentUser) {
	                alert(d.loginRequiredMessageText);
	                closeAllUiOverlays();
	                openProfileDropdown();
	                return;
	            }
            if (cart.length === 0) {
                alert("Savatchangiz  bo'sh!");
                return;
            }
            currentStep = 'checkout';
            document.getElementById('cartView').style.display = 'none';
            document.getElementById('checkoutView').style.display = 'block';
            document.getElementById('step1').classList.remove('active');
            document.getElementById('step2').classList.add('active');
            updateCheckoutForm();
            refreshCheckoutAddressSection();
            updateCheckoutSummary();
        }

        function showCart() {
            currentStep = 'cart';
            document.getElementById('cartView').style.display = 'block';
            document.getElementById('checkoutView').style.display = 'none';
            document.getElementById('step1').classList.add('active');
            document.getElementById('step2').classList.remove('active');
        }

        function updateCheckoutSummary() {
            const d = langData[currentLang];
            const summary = document.getElementById('checkoutSummary');
            let html = '', total = 0;
            cart.forEach(item => {
                const itemTotal = item.price * item.quantity;
                total += itemTotal;
                const n = item.name[currentLang] || item.name.uz || item.name;
                html += `<div class="summary-item">
                        <span>${n} x${item.quantity} (${getLocalizedWeightText(item.weight, currentLang)})</span>
                        <span>${itemTotal.toLocaleString()} ${d.currency}</span>
                    </div>`;
            });
            const courierChecked = document.getElementById('courierDelivery')?.checked || false;
            if (courierChecked && cart.length > 0) {
                html += `<div class="summary-item" style="color:var(--courier);">
                        <span>🚚 ${d.courierLabel.replace('🚚 ', '')}</span>
                        <span>+${COURIER_PRICE.toLocaleString()} ${d.currency}</span>
                    </div>`;
                total += COURIER_PRICE;
            }
            html += `<div class="summary-total">
                    <span>${d.totalLabel}</span>
                    <span>${total.toLocaleString()} ${d.currency}</span>
                </div>`;
            summary.innerHTML = html;
        }

        function refreshCheckoutAddressSection() {
            const section = document.getElementById('checkoutAddressSection');
            if (!section) return;
            const courierSelected = document.getElementById('courierDelivery')?.checked;
            section.style.display = courierSelected ? 'block' : 'none';
            document.getElementById('addressInput').required = Boolean(courierSelected);
            if (!courierSelected) setAddressError('');
        }

        async function submitOrder() {
            const d = langData[currentLang];
            if (!currentUser) { alert("Avval kiring!"); return; }
            const name = document.getElementById('nameInput').value.trim();
            const phone = document.getElementById('phoneInput').value.trim();
            const address = document.getElementById('addressInput').value.trim();
            const note = document.getElementById('noteInput').value.trim();
            const courier = document.getElementById('courierDelivery').checked;
            const validAddress = validateAddress(true);
            if (!name || !isValidUzbekPhone(phone) || (courier && !validAddress)) {
                alert("❌ Barcha majburiy maydonlarni to'ldiring!");
                return;
            }

            let total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            if (courier) total += COURIER_PRICE;

            let order = {
                id: generateOrderId(),
                orderTime: new Date().toISOString(),
                status: 'preparing',
                customer: name,
                phone: phone,
                address: courier ? address : '',
                note: note || 'Yoq',
                userId: currentUser.id,
                courier: courier,
                mapUrl: courier ? (selectedMapLocation || '') : '',
                items: cart.map(item => ({
                    name: item.name[currentLang] || item.name.uz || item.name,
                    weight: normalizeProductWeight(item.weight),
                    quantity: item.quantity,
                    price: item.price,
                    total: item.price * item.quantity
                })),
                total: total
            };

            try {
                const data = await safeApiRequest('/api/orders', {
                    method: 'POST',
                    body: { order }
                });
                order = data.order || order;
            } catch (error) {
                orders.push(order);
            }
            if (!orders.some(existing => String(existing.id) === String(order.id))) orders.push(order);
            localStorage.setItem('orders', JSON.stringify(orders));

            // Telegramga xabar yuborish
            const noteText = order.note || 'Yoq';
            const deliveryText = courier ? 'Kuryer' : 'Olib ketish';
            const orderNumber = formatOrderNumber(order.id);
            let orderText = `🆕 YANGI BUYURTMA ${orderNumber}\n`;
            orderText += `👤 Mijoz: ${name}\n`;
            orderText += `📞 Telefon: ${phone}\n`;
            if (courier && order.address) orderText += `📍 Manzil: ${order.address}\n`;
            if (order.mapUrl) orderText += `🗺️ Map: ${order.mapUrl}\n`;
            orderText += `🚚 Yetkazish: ${deliveryText}\n`;
            orderText += `📝 Eslatma: ${noteText}\n\n`;
            orderText += `📦 Buyurtmalar:\n`;
            order.items.forEach(item => {
                orderText += `   • ${item.name} ${getLocalizedWeightText(item.weight, currentLang)} x${item.quantity} = ${(item.price * item.quantity).toLocaleString()} so'm\n`;
            });
            orderText += `\n💰 JAMI: ${total.toLocaleString()} so'm`;

            await sendTelegramMessage(orderText);

            products.forEach(p => p.quantity = 0);
            cart = [];
            updateCart();
            document.getElementById('addressInput').value = ADDRESS_PREFIX;
            setAddressError('');
            document.getElementById('noteInput').value = '';
            document.getElementById('courierDelivery').checked = false;
            selectedMapLocation = null;
            refreshCheckoutAddressSection();
            showCart();
            togglePanel('cartPanel');
            displayProducts(currentCategory);
            displayMyOrders();
            showNotification(d.notificationOrderSuccess, d.notificationOrderMsg, "success");
        }

        function formatOrderNumber(id) {
            const value = id % 1000000;
            return '#' + String(value).padStart(6, '0');
        }

        function goToProduct(productId) {
            const element = document.getElementById(`card-${productId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.style.transform = 'scale(1.02)';
                setTimeout(() => element.style.transform = '', 1000);
            }
        }

        function searchProducts() {
            const searchInput = document.getElementById('searchInput');
            searchQuery = searchInput.value.toLowerCase().trim();
            document.getElementById('clearSearch').style.display = searchQuery.length > 0 ? 'block' : 'none';
            document.getElementById('searchStats').style.display = searchQuery.length > 0 ? 'block' : 'none';
            displayProducts(currentCategory);
        }

        function clearSearch() {
            document.getElementById('searchInput').value = '';
            searchQuery = '';
            document.getElementById('clearSearch').style.display = 'none';
            document.getElementById('searchStats').style.display = 'none';
            displayProducts(currentCategory);
        }

        function filterMenu(cat, btn) {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            displayProducts(cat);
        }

        // ==================== ADMIN FUNKSIYALARI ====================
        function handleAdminKeyPress(e) { if (e.key === 'Enter') checkAdminPassword(); }

        async function checkAdminPassword() {
            let pwd = document.getElementById('adminPassword').value;
            if (pwd === "12345566") {
                isAdminLoggedIn = true;
                if (currentUser?.isAdmin) {
                    await Promise.all([loadProductsData(), loadRoomsData(), loadOrdersData()]);
                }
                document.getElementById('adminLogin').style.display = 'none';
                document.getElementById('adminContent').style.display = 'block';
                updateAdminStats();
                displayOrders();
                displayUsers();
                displayRooms();
                displayProductsForEdit();
                displayUsersEdit();
                showNotification("✅ Admin panel", "Xush kelibsiz!", "success");
            } else alert("❌ Noto'g'ri parol!");
        }

        function logoutAdmin() {
            isAdminLoggedIn = false;
            document.getElementById('adminLogin').style.display = 'block';
            document.getElementById('adminContent').style.display = 'none';
            document.getElementById('adminPassword').value = '';
            toggleAdminPanel();
        }

        function switchAdminTab(tab, el) {
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.admin-content').forEach(c => c.classList.remove('active'));
            el.classList.add('active');
            document.getElementById(tab).classList.add('active');
            if (tab === 'orders') displayOrders();
            if (tab === 'users') displayUsers();
            if (tab === 'rooms') displayRooms();
            if (tab === 'products') displayProductsForEdit();
            if (tab === 'usersEdit') displayUsersEdit();
            if (tab === 'dashboard') updateAdminStats();
        }

        function updateAdminStats() {
            document.getElementById('totalOrdersStat').innerText = orders.length;
            document.getElementById('totalRevenueStat').innerText = orders.reduce((s, o) => s + o.total, 0).toLocaleString();
            document.getElementById('totalProductsStat').innerText = products.length;
            document.getElementById('totalRoomsStat').innerText = `${rooms.filter(r => r.isBooked).length}/15`;
        }
        function displayOrders() {
            const d = langData[currentLang];
            let list = document.getElementById('ordersList'), html = '<table class="orders-table"><thead><tr>';
            html += `<th>${d.ordersThTime}</th><th>${d.ordersThCustomer}</th><th>${d.ordersThPhone}</th><th>${d.ordersThAddress}</th>`;
            html += `<th>${d.ordersThItems}</th><th>${d.ordersThDelivery}</th><th>${d.ordersThTotal}</th><th>${d.ordersThActions}</th>`;
            html += `</tr></thead><tbody>`;
            orders.slice().reverse().forEach(o => {
                html += `<tr>
                        <td>${new Date(o.orderTime).toLocaleString()}</td>
                        <td>${o.customer}</td>
                        <td>${o.phone}</td>
                        <td>${o.address}</td>
                        <td class="order-items">${o.items.map(i => `${i.name} x${i.quantity}`).join('<br>')}</td>
                        <td>${o.courier ? '🚚 Kuryer' : '📦 Olib ketish'}</td>
                        <td>${o.total.toLocaleString()} ${d.currency}</td>
                        <td><button class="delete-order-btn" onclick="deleteOrder(${o.id})">🗑 O'chirish</button></td>
                    </tr>`;
            });
            html += `</tbody></table>`;
            list.innerHTML = html;
        }

        async function deleteOrder(id) {
            if (confirm("O'chirilsinmi?")) {
                try {
                    const data = await safeApiRequest(`/api/orders/${id}`, { method: 'DELETE' });
                    orders = Array.isArray(data.orders) ? data.orders : orders.filter(o => o.id !== id);
                } catch (error) {
                    orders = orders.filter(o => o.id !== id);
                }
                localStorage.setItem('orders', JSON.stringify(orders));
                displayOrders();
                updateAdminStats();
                displayMyOrders();
            }
        }

        function displayUsers() {
            const d = langData[currentLang];
            let list = document.getElementById('usersList'), html = '<table class="users-table"><thead><tr>';
            html += `<th>${d.usersThName}</th><th>${d.usersThPhone}</th><th>${d.usersThStatus}</th><th>${d.usersThMaxOrder}</th><th>${d.usersThActions}</th>`;
            html += `</tr></thead><tbody>`;
            users.forEach(u => {
                html += `<tr>
                        <td>${u.name}</td>
                        <td>${u.phone}</td>
                        <td>${u.blocked ? '<span class="badge badge-danger">Bloklangan</span>' : (u.isAdmin ? '<span class="badge badge-admin">⚜️ Admin</span>' : '<span class="badge badge-success">Faol</span>')}</td>
                        <td><input type="number" id="max-${u.id}" value="${u.maxOrder || 100}" style="width:70px;"><button class="update-max-btn" onclick="updateMaxOrder(${u.id})">✓</button></td>
                        <td>
                            <button class="block-btn" onclick="toggleUserBlock(${u.id})">${u.blocked ? 'Ochish' : 'Bloklash'}</button>
                            ${!u.isAdmin ? '<button class="make-admin-btn" onclick="toggleAdminRole(' + u.id + ')">Admin qilish</button>' : '<button class="remove-admin-btn" onclick="toggleAdminRole(' + u.id + ')">Admin olish</button>'}
                            <button class="delete-user-btn" onclick="deleteUser(${u.id})">🗑</button>
                        </td>
                    </tr>`;
            });
            html += `</tbody></table>`;
            list.innerHTML = html;
        }

        function displayUsersEdit() {
            const d = langData[currentLang];
            const list = document.getElementById('usersEditList');
            let html = '<div class="users-edit-grid">';
            users.forEach(u => {
                html += `<div class="user-edit-card" style="background:rgba(255,255,255,0.03); border:1px solid rgba(74,144,226,0.2); border-radius:12px; padding:15px; margin-bottom:15px;">
                        <div class="user-edit-avatar" style="text-align:center; margin-bottom:10px;">
                            <img src="${u.avatar || 'https://via.placeholder.com/80'}" style="width:80px; height:80px; border-radius:50%; object-fit:cover; border:2px solid var(--primary);" onclick="changeUserAvatar('${u.id}')" style="cursor:pointer;">
                        </div>
                        <div class="profile-field"><label>Avatar URL:</label><input type="text" id="user_avatar_${u.id}" value="${u.avatar || ''}" placeholder="Rasm URL" style="width:100%; padding:8px; background:#2c1e14; border-radius:6px; color:white;"></div>
                        <div class="profile-field"><label>${d.profileNameLabel}:</label><input type="text" id="user_name_${u.id}" value="${u.name}" style="width:100%; padding:8px; background:#2c1e14; border-radius:6px; color:white;"></div>
                        <div class="profile-field"><label>${d.profilePhoneLabel}:</label><input type="text" id="user_phone_${u.id}" value="${u.phone}" style="width:100%; padding:8px; background:#2c1e14; border-radius:6px; color:white;"></div>
                        <div class="profile-field"><label>Parol:</label><input type="password" id="user_password_${u.id}" placeholder="Yangi parol (ixtiyoriy)" style="width:100%; padding:8px; background:#2c1e14; border-radius:6px; color:white;"></div>
                        <div class="profile-field"><label>Max. buyurtma:</label><input type="number" id="user_maxorder_${u.id}" value="${u.maxOrder || 100}" style="width:100%; padding:8px; background:#2c1e14; border-radius:6px; color:white;"></div>
                        <div class="profile-field"><label>Admin huquqi:</label><input type="checkbox" id="user_isadmin_${u.id}" ${u.isAdmin ? 'checked' : ''} style="accent-color:var(--primary);"></div>
                        <div class="profile-field"><label>Bloklangan:</label><input type="checkbox" id="user_blocked_${u.id}" ${u.blocked ? 'checked' : ''} style="accent-color:var(--danger);"></div>
                        <button class="save-btn" onclick="saveUserEdit('${u.id}')" style="margin-top:10px;">💾 Saqlash</button>
                        <button class="delete-btn" onclick="deleteUser('${u.id}')" style="margin-top:5px;">🗑 O'chirish</button>
                    </div>`;
            });
            html += '</div>';
            list.innerHTML = html;
        }

        function changeUserAvatar(userId) {
            const url = prompt("Yangi avatar URL manzilini kiriting:");
            if (url) {
                document.getElementById(`user_avatar_${userId}`).value = url;
            }
        }

        function enforceSingleAdmin() {
            // Ensure there is at most 1 admin across all users.
            let found = false;
            let changed = false;
            users.forEach(u => {
                if (!u.isAdmin) return;
                if (!found) {
                    found = true;
                } else {
                    u.isAdmin = false;
                    changed = true;
                }
            });
            if (changed) localStorage.setItem('users', JSON.stringify(users));
            if (currentUser) {
                const stored = users.find(u => u.id === currentUser.id);
                if (stored && currentUser.isAdmin !== stored.isAdmin) {
                    currentUser.isAdmin = stored.isAdmin;
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                }
            }
        }

        function assignAdminByHotkey() {
            if (!isAdminLoggedIn) return;
            if (!Array.isArray(users) || users.length === 0) {
                alert("Foydalanuvchilar yo'q.");
                return;
            }
            const list = users.map(u => `${u.id} - ${u.name} (${u.phone})${u.isAdmin ? ' [ADMIN]' : ''}`).join('\n');
            const idRaw = prompt("ADMIN tanlang (faqat 1 ta bo'ladi). ID ni yozing:\n\n" + list);
            const id = parseInt(String(idRaw || '').trim(), 10);
            if (!id) return;
            const target = users.find(u => u.id === id);
            if (!target) { alert("Bunday ID topilmadi."); return; }
            users.forEach(u => { u.isAdmin = u.id === id; });
            localStorage.setItem('users', JSON.stringify(users));
            if (currentUser) {
                const stored = users.find(u => u.id === currentUser.id);
                if (stored) {
                    currentUser.isAdmin = stored.isAdmin;
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                }
            }
            displayUsers();
            displayUsersEdit();
            updateProfileDropdown();
            alert(`✅ ADMIN: ${target.name}`);
        }

        document.addEventListener('keydown', (e) => {
            const key = (e.key || '').toLowerCase();
            if (e.altKey && e.shiftKey && key === 'd') {
                e.preventDefault();
                assignAdminByHotkey();
                return;
            }

            if (e.altKey && e.shiftKey && key === 'x') {
                e.preventDefault();
                const adminPanel = document.getElementById('adminPanel');
                if (adminPanel && !adminPanel.classList.contains('active')) toggleAdminPanel();
                return;
            }

            if (e.altKey && e.shiftKey && key === 'a' && adminPanelAltShiftAEnabled) {
                e.preventDefault();
                const adminPanel = document.getElementById('adminPanel');
                if (adminPanel && !adminPanel.classList.contains('active')) toggleAdminPanel();
                adminPanelAltShiftAEnabled = false;
            }
        });

        function saveUserEdit(userId) {
            const user = users.find(u => u.id == userId);
            if (!user) return;
            const newAvatar = document.getElementById(`user_avatar_${userId}`).value;
            const newName = document.getElementById(`user_name_${userId}`).value;
            const newPhone = document.getElementById(`user_phone_${userId}`).value;
            const newPassword = document.getElementById(`user_password_${userId}`).value;
            const newMaxOrder = parseInt(document.getElementById(`user_maxorder_${userId}`).value);
            const newIsAdmin = document.getElementById(`user_isadmin_${userId}`).checked;
            const newBlocked = document.getElementById(`user_blocked_${userId}`).checked;

            if (!newName) { alert("Ism majburiy!"); return; }
            if (!isValidUzbekPhone(newPhone)) { alert("❌ Noto'g'ri telefon raqam!"); return; }

            user.avatar = newAvatar;
            user.name = newName;
            user.phone = newPhone;
            if (newPassword && newPassword.length >= 4) user.password = newPassword;
            user.maxOrder = newMaxOrder;
            if (newIsAdmin) {
                users.forEach(u => { if (u.id !== user.id && u.isAdmin) u.isAdmin = false; });
            }
            user.isAdmin = newIsAdmin;
            user.blocked = newBlocked;

            localStorage.setItem('users', JSON.stringify(users));
            if (currentUser && currentUser.id == userId) {
                currentUser = user;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                updateProfileDropdown();
                updateLoginRequiredMessage();
            }
            displayUsers();
            displayUsersEdit();
            alert("✅ Foydalanuvchi ma'lumotlari saqlandi!");
        }

        function deleteUser(id) {
            if (confirm("O'chirilsinmi?")) {
                users = users.filter(u => u.id !== id);
                localStorage.setItem('users', JSON.stringify(users));
                if (currentUser && currentUser.id == id) { logoutUser(); }
                displayUsers();
                displayUsersEdit();
            }
        }

        function toggleUserBlock(id) {
            let u = users.find(u => u.id === id);
            if (u) {
                u.blocked = !u.blocked;
                localStorage.setItem('users', JSON.stringify(users));
                if (currentUser && currentUser.id === id) {
                    currentUser.blocked = u.blocked;
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                    updateLoginRequiredMessage();
                    displayProducts(currentCategory);
                }
                displayUsers();
                displayUsersEdit();
            }
        }

        function toggleAdminRole(id) {
            let u = users.find(u => u.id === id);
            if (u) {
                const next = !u.isAdmin;
                if (next) {
                    users.forEach(x => { if (x.id !== u.id && x.isAdmin) x.isAdmin = false; });
                }
                u.isAdmin = next;
                localStorage.setItem('users', JSON.stringify(users));
                if (currentUser && currentUser.id === id) {
                    currentUser.isAdmin = u.isAdmin;
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                    updateProfileDropdown();
                }
                displayUsers();
                displayUsersEdit();
            }
        }

        function updateMaxOrder(id) {
            let val = parseInt(document.getElementById(`max-${id}`).value);
            if (val >= 1 && val <= 1000) {
                let u = users.find(u => u.id === id);
                u.maxOrder = val;
                localStorage.setItem('users', JSON.stringify(users));
                if (currentUser && currentUser.id === id) {
                    currentUser.maxOrder = val;
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                }
                alert("✅ Yangilandi!");
                displayUsersEdit();
            }
        }
        function displayProductsForEdit() {
            const d = langData[currentLang];
            const grid = document.getElementById('productsGrid');
            grid.innerHTML = '';
            let filtered = products;
            if (adminCategoryFilter !== 'all') filtered = filtered.filter(p => p.cat === adminCategoryFilter);
            if (adminSearchQuery) filtered = filtered.filter(p => (p.name[currentLang] || p.name.uz || p.name).toLowerCase().includes(adminSearchQuery));

            document.getElementById('adminSearchStats').style.display = filtered.length !== products.length ? 'block' : 'none';
            document.getElementById('adminSearchCount').innerText = filtered.length;

            filtered.forEach(p => {
                const nameUz = p.name.uz || p.name;
                const nameRu = p.name.ru || p.name;
                const nameEn = p.name.en || p.name;
                const imgCandidates = getProductImageCandidates(p);
                const imgFallbacks = encodeURIComponent(JSON.stringify(imgCandidates));
                grid.innerHTML += `<div class="product-edit-card">
                <img src="${imgCandidates[0]}" data-fallbacks="${imgFallbacks}" data-fallback-index="0" onerror="handleProductImgError(this)" onclick="changeProductImage('${p.id}')" loading="lazy" decoding="async" fetchpriority="low" alt="${this.escapeHtml(nameUz)}" style="width:100%; height:140px; object-fit:cover; cursor:pointer;">
                <div style="display:flex; gap:10px; margin: 10px 0;">
                    <input type="file" id="img_upload_${p.id}" accept="image/*" style="display:none;" onchange="uploadExistingProductImage('${p.id}', this)">
                    <button type="button" class="image-upload-btn" onclick="document.getElementById('img_upload_${p.id}').click()">📁 Yuklash</button>
                    <button type="button" class="image-upload-btn" onclick="changeProductImage('${p.id}')">🔗 URL</button>
                </div>
                <div style="margin-top:10px;"><label style="color:var(--primary); font-size:12px;">🇺🇿 O'zbekcha:</label>
                <input type="text" value="${this.escapeHtml(nameUz)}" id="name_uz_${p.id}" placeholder="O'zbekcha nomi" style="width:100%; margin-bottom:5px;"></div>
                <div><label style="color:var(--primary); font-size:12px;">🇷🇺 Русский:</label>
                <input type="text" value="${this.escapeHtml(nameRu)}" id="name_ru_${p.id}" placeholder="Русское название" style="width:100%; margin-bottom:5px;"></div>
                <div><label style="color:var(--primary); font-size:12px;">🇬🇧 English:</label>
                <input type="text" value="${this.escapeHtml(nameEn)}" id="name_en_${p.id}" placeholder="English name" style="width:100%; margin-bottom:5px;"></div>
                <div><label style="color:var(--primary); font-size:12px;">🇺🇿 Weight:</label>
                <input type="text" value="${this.escapeHtml(getLocalizedWeightText(p.weight, 'uz'))}" id="weight_uz_${p.id}" placeholder="1 Dona" style="width:100%; margin-bottom:5px;"></div>
                <div><label style="color:var(--primary); font-size:12px;">🇷🇺 Weight:</label>
                <input type="text" value="${this.escapeHtml(getLocalizedWeightText(p.weight, 'ru'))}" id="weight_ru_${p.id}" placeholder="1 шт" style="width:100%; margin-bottom:5px;"></div>
                <div><label style="color:var(--primary); font-size:12px;">🇬🇧 Weight:</label>
                <input type="text" value="${this.escapeHtml(getLocalizedWeightText(p.weight, 'en'))}" id="weight_en_${p.id}" placeholder="1 pc" style="width:100%; margin-bottom:5px;"></div>
                <select id="cat-${p.id}" style="width:100%; margin-bottom:5px;">
                    <option value="salat" ${p.cat === 'salat' ? 'selected' : ''}>${d.catSalat}</option>
                    <option value="milliy" ${p.cat === 'milliy' ? 'selected' : ''}>${d.catMilliy}</option>
                    <option value="yevropa" ${p.cat === 'yevropa' ? 'selected' : ''}>${d.catYevropa}</option>
                    <option value="turkish" ${p.cat === 'turkish' ? 'selected' : ''}>${d.catTurkish}</option>
                    <option value="firmali" ${p.cat === 'firmali' ? 'selected' : ''}>${d.catFirmali}</option>
                    <option value="pide" ${p.cat === 'pide' ? 'selected' : ''}>${d.catPide}</option>
                    <option value="ichimlik" ${p.cat === 'ichimlik' ? 'selected' : ''}>${d.catIchimlik}</option>
                    <option value="shirinlik" ${p.cat === 'shirinlik' ? 'selected' : ''}>${d.catShirinlik}</option>
                </select>
                <input type="number" value="${p.price}" id="price-${p.id}" placeholder="Narxi" style="width:100%; margin-bottom:5px;">
                <input type="number" value="${p.price2 || ''}" id="price2-${p.id}" placeholder="Narx 2 (ixtiyoriy)" style="width:100%; margin-bottom:5px;">
                <button class="save-btn" onclick="saveProductFull('${p.id}')" style="background:var(--primary); width:100%; padding:8px; border:none; border-radius:6px; cursor:pointer;">Saqlash</button>
                <button class="delete-btn" onclick="deleteProduct('${p.id}')" style="background:var(--danger); width:100%; padding:8px; margin-top:5px; border:none; border-radius:6px; cursor:pointer;">O'chirish</button>
            </div>`;
            });
        }

        // HTML escape funksiyasi
        function escapeHtml(text) {
            if (!text) return '';
            return text.replace(/[&<>]/g, function (m) {
                if (m === '&') return '&amp;';
                if (m === '<') return '&lt;';
                if (m === '>') return '&gt;';
                return m;
            });
        }

        async function saveProductFull(productId) {
            const product = products.find(p => p.id === productId);
            if (!product) return;
            const nameUz = document.getElementById(`name_uz_${productId}`)?.value;
            const nameRu = document.getElementById(`name_ru_${productId}`)?.value;
            const nameEn = document.getElementById(`name_en_${productId}`)?.value;
            const weightUz = document.getElementById(`weight_uz_${productId}`)?.value.trim();
            const weightRu = document.getElementById(`weight_ru_${productId}`)?.value.trim();
            const weightEn = document.getElementById(`weight_en_${productId}`)?.value.trim();
            if (nameUz) product.name.uz = nameUz;
            if (nameRu) product.name.ru = nameRu;
            if (nameEn) product.name.en = nameEn;
            product.weight = {
                uz: weightUz || DEFAULT_PRODUCT_WEIGHT.uz,
                ru: weightRu || DEFAULT_PRODUCT_WEIGHT.ru,
                en: weightEn || DEFAULT_PRODUCT_WEIGHT.en
            };
            product.cat = document.getElementById(`cat-${productId}`)?.value || product.cat;
            product.price = parseInt(document.getElementById(`price-${productId}`)?.value) || product.price;
            const p2raw = document.getElementById(`price2-${productId}`)?.value;
            const p2 = parseInt(String(p2raw ?? '').trim(), 10);
            if (Number.isFinite(p2) && p2 > 0) product.price2 = p2;
            else delete product.price2;
            try {
                const data = await safeApiRequest(`/api/products/${encodeURIComponent(productId)}`, {
                    method: 'PATCH',
                    body: { product }
                });
                if (data.product) {
                    const idx = products.findIndex(p => p.id === productId);
                    if (idx !== -1) products[idx] = { ...data.product, quantity: products[idx].quantity || 0 };
                }
            } catch (error) {
                console.warn('Product save fallback:', error);
            }
            localStorage.setItem('products', JSON.stringify(products));
            displayProducts(currentCategory);
            displayProductsForEdit();
            alert("✅ Mahsulot saqlandi!");
        }

	        // ==================== IMAGE VIEWER (FULLSCREEN) ====================
	        let imageModalState = { open: false };

	        function openImageModal(src, alt = '') {
	            const modal = document.getElementById('imageModal');
	            const img = document.getElementById('imageModalImg');
	            if (!modal || !img) return;
	            img.src = src;
	            img.alt = alt;
	            modal.classList.add('active');
	            imageModalState.open = true;
	        }

	        function closeImageModal() {
	            const modal = document.getElementById('imageModal');
	            const img = document.getElementById('imageModalImg');
	            if (modal) modal.classList.remove('active');
	            if (img) img.src = '';
	            imageModalState.open = false;
	        }



        async function deleteProduct(productId) {
            if (confirm("Mahsulotni o'chirilsinmi?")) {
                try {
                    const data = await safeApiRequest(`/api/products/${encodeURIComponent(productId)}`, {
                        method: 'DELETE'
                    });
                    products = Array.isArray(data.products) ? cloneProductsForStorage(data.products) : products.filter(p => p.id !== productId);
                } catch (error) {
                    products = products.filter(p => p.id !== productId);
                }
                localStorage.setItem('products', JSON.stringify(products));
                displayProducts(currentCategory);
                displayProductsForEdit();
                alert("✅ Mahsulot o'chirildi!");
            }
        }

        async function addNewProductFull() {
            const nameUz = document.getElementById('newProductName')?.value.trim();
            const nameRu = document.getElementById('newProductNameRu')?.value.trim();
            const nameEn = document.getElementById('newProductNameEn')?.value.trim();
            const cat = document.getElementById('newProductCat')?.value;
            const price = parseInt(document.getElementById('newProductPrice')?.value);
            const weight = document.getElementById('newProductWeight')?.value.trim();
            const img = document.getElementById('newProductImage')?.value.trim() || "Menyu/";

            if (!nameUz) { alert("❌ Mahsulot nomi (o'zbekcha) majburiy!"); return; }
            if (!price || price <= 0) { alert("❌ To'g'ri narx kiriting!"); return; }
            if (!weight) { alert("❌ Mahsulot miqdorini kiriting!"); return; }

            const newProduct = {
                id: 'new' + Date.now(),
                cat: cat,
                name: { uz: nameUz, ru: nameRu || nameUz, en: nameEn || nameUz },
                weight: { uz: weight, ru: weight, en: weight },
                price: price,
                img: img,
                quantity: 0
            };
            try {
                const data = await safeApiRequest('/api/products', {
                    method: 'POST',
                    body: { product: newProduct }
                });
                products.push({ ...(data.product || newProduct), quantity: 0 });
            } catch (error) {
                products.push(newProduct);
            }
            localStorage.setItem('products', JSON.stringify(products));
            alert("✅ Yangi mahsulot qo'shildi!");

            document.getElementById('newProductName').value = '';
            document.getElementById('newProductNameRu').value = '';
            document.getElementById('newProductNameEn').value = '';
            document.getElementById('newProductPrice').value = '';
            document.getElementById('newProductWeight').value = '1 Dona';
            document.getElementById('newProductImage').value = 'Menyu/';
            displayProducts(currentCategory);
            displayProductsForEdit();
        }

        function filterAdminProducts() {
            adminSearchQuery = document.getElementById('adminSearchInput')?.value.toLowerCase().trim() || '';
            displayProductsForEdit();
        }

        function filterAdminByCategory() {
            adminCategoryFilter = document.getElementById('adminCategoryFilter')?.value || 'all';
            displayProductsForEdit();
        }

        function clearAdminSearch() {
            document.getElementById('adminSearchInput').value = '';
            adminSearchQuery = '';
            displayProductsForEdit();
        }

        async function changeAllProductImages() {
            let url = prompt("Barcha rasmlar uchun URL:");
            if (url) {
                products.forEach(p => p.img = url);
                try {
                    const data = await safeApiRequest('/api/products/images', {
                        method: 'PATCH',
                        body: { url }
                    });
                    if (Array.isArray(data.products)) products = cloneProductsForStorage(data.products);
                } catch (error) {
                    console.warn('Bulk product image fallback:', error);
                }
                localStorage.setItem('products', JSON.stringify(products));
                displayProducts(currentCategory);
                displayProductsForEdit();
            }
        }

        async function changeProductImage(pid) {
            let url = prompt("Yangi rasm URL:");
            if (url) {
                let p = products.find(p => p.id === pid);
                p.img = url;
                try {
                    const data = await safeApiRequest(`/api/products/${encodeURIComponent(pid)}`, {
                        method: 'PATCH',
                        body: { product: p }
                    });
                    if (data.product) Object.assign(p, { ...data.product, quantity: p.quantity || 0 });
                } catch (error) {
                    console.warn('Product image save fallback:', error);
                }
                localStorage.setItem('products', JSON.stringify(products));
                displayProducts(currentCategory);
                displayProductsForEdit();
            }
        }

        function fileToResizedDataUrl(file, maxSize = 900, quality = 0.85) {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const img = new Image();
                    img.onload = () => {
                        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
                        const w = Math.max(1, Math.round(img.width * scale));
                        const h = Math.max(1, Math.round(img.height * scale));
                        const canvas = document.createElement('canvas');
                        canvas.width = w;
                        canvas.height = h;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, w, h);
                        // JPEG is much smaller than PNG for photos, keeps localStorage usable.
                        const dataUrl = canvas.toDataURL('image/jpeg', quality);
                        resolve(dataUrl);
                    };
                    img.onerror = () => resolve(reader.result);
                    img.src = reader.result;
                };
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(file);
            });
        }

        async function uploadExistingProductImage(productId, input) {
            const file = input?.files?.[0];
            if (!file) return;
            const product = products.find(p => p.id === productId);
            if (!product) return;
            const dataUrl = await fileToResizedDataUrl(file);
            if (!dataUrl) return;
            product.img = dataUrl;
            try {
                try {
                    const data = await safeApiRequest(`/api/products/${encodeURIComponent(productId)}`, {
                        method: 'PATCH',
                        body: { product }
                    });
                    if (data.product) Object.assign(product, { ...data.product, quantity: product.quantity || 0 });
                } catch (error) {
                    console.warn('Uploaded image save fallback:', error);
                }
                localStorage.setItem('products', JSON.stringify(products));
            } catch (e) {
                alert("Rasm juda katta bo'lib qoldi. Iltimos, kichikroq rasm tanlang.");
                return;
            }
            displayProducts(currentCategory);
            displayProductsForEdit();
            showNotification("✅ Rasm yuklandi", "", "success");
            input.value = '';
        }

        function uploadProductImage(input) {
            let f = input.files[0];
            if (f) {
                let r = new FileReader();
                r.onload = e => {
                    document.getElementById('newProductImage').value = e.target.result;
                    showNotification("✅ Rasm yuklandi", "", "success");
                };
                r.readAsDataURL(f);
            }
        }

        // ==================== ONLINE USERS ====================
        function updateOnlineUsers() {
            let list = readJSONFromLocalStorage('onlineUsers', []) || [], now = Date.now();
            list = list.filter(u => (now - u.timestamp) < 900);
            let ex = list.find(u => u.id === userId);
            if (ex) ex.timestamp = now;
            else list.push({ id: userId, timestamp: now });
            localStorage.setItem('onlineUsers', JSON.stringify(list));
            onlineUsers = list.length;
            let el = document.getElementById('onlineUsersCount');
            if (el) el.innerText = onlineUsers;
        }

        // ==================== TIL O'ZGARTIRISH ====================
        function changeLang(lang) {
            currentLang = lang;
            const d = langData[lang];

            // Matnlarni yangilash
            const elements = ['navAbout', 'logoMajmuasi', 'logoSub', 'adminPanelTitle', 'adminLoginTitle', 'adminLoginBtn',
                'tabDashboard', 'tabUsers', 'tabOrders', 'tabRooms', 'tabProducts', 'tabAddProduct', 'tabUsersEdit', 'tabLogout',
                'dashboardTitle', 'onlineUsersLabel', 'totalOrdersLabel', 'totalRevenueLabel', 'totalProductsLabel', 'totalRoomsLabel',
                'recentOrdersTitle', 'usersTitle', 'addUserTitle', 'adminCheckboxLabel', 'addUserBtn', 'adminCountText',
                'usersThName', 'usersThPhone', 'usersThStatus', 'usersThMaxOrder', 'usersThActions', 'ordersTitle',
                'ordersThTime', 'ordersThCustomer', 'ordersThPhone', 'ordersThAddress', 'ordersThItems', 'ordersThDelivery',
                'ordersThStatus', 'ordersThTotal', 'ordersThActions', 'roomsTitle', 'productsTitle', 'changeAllImagesText',
                'filterAll', 'filterSalat', 'filterMilliy', 'filterYevropa', 'filterTurkish', 'filterFirmali', 'filterPide',
                'filterIchimlik', 'filterShirinlik', 'adminSearchStatsText', 'addProductTitle', 'newProductNameLabel',
                'newProductCatLabel', 'newProductPriceLabel', 'newProductWeightLabel', 'newProductImageLabel', 'addProductBtn',
                'catSalat', 'catMilliy', 'catYevropa', 'catTurkish', 'catFirmali', 'catPide', 'catIchimlik', 'catShirinlik',
                'roomsPanelTitle', 'bookingTitle', 'roomNumberLabel', 'roomSelectLabel', 'roomNameLabel', 'roomPhoneLabel', 'roomPhoneHelper', 'roomDateLabel', 'roomDateHelper', 'startTimeLabel', 'endTimeLabel', 'roomTimeHelper',
                'bookRoomBtn', 'myOrdersPanelTitle', 'loginRequiredOrdersText', 'loginRequiredOrdersBtn', 'badgeText',
                'heroTitleSpan', 'heroDesc', 'ctaBtn', 'stat1', 'stat2', 'stat3', 'loginRequiredMessageText', 'loginRequiredMessageBtn',
                'step1', 'step2', 'cartTitle', 'courierLabel', 'courierPrice', 'totalLabel', 'backToCartBtn', 'checkoutTitle',
                'nameLabel', 'phoneLabel', 'phoneHelp', 'addressLabel', 'addressHelp', 'noteLabel', 'promoLabel', 'submitOrderBtn',
                'aboutTitle', 'aboutText1', 'aboutCloseBtn', 'footerText', 'footerCopyright', 'mobileProfileText', 'mobileOrdersText',
                'mobileRoomsText', 'mobileCartText', 'mobileAboutText', 'mobileAdminText', 'aboutLocation', 'aboutPhone1', 'aboutTG1',
                'aboutName', 'aboutPhone2', 'aboutTG2', 'selectFromMap', 'confirmLocation', 'cancel'];

            elements.forEach(id => { let el = document.getElementById(id); if (el && d[id]) el.innerText = d[id]; });

            const heroTitleFirst = document.getElementById('heroTitleFirst');
            if (heroTitleFirst && d.heroTitleFirst) heroTitleFirst.innerText = d.heroTitleFirst;
            const heroTitleSpan = document.getElementById('heroTitleSpan');
            if (heroTitleSpan && d.heroTitleSpan) heroTitleSpan.innerText = d.heroTitleSpan;

            document.getElementById('searchInput').placeholder = d.searchPlaceholder;
            document.getElementById('searchResultText').innerHTML = ` ${d.searchResults}`;
            document.querySelectorAll('.currency').forEach(el => el.innerText = d.currency);

            const cats = ['all', 'salat', 'milliy', 'yevropa', 'turkish', 'firmali', 'pide', 'ichimlik', 'shirinlik'];
            const catNames = {
                all: d.all, salat: d.salat, milliy: d.milliy, yevropa: d.yevropa, turkish: d.turkish,
                firmali: d.firmali, pide: d.pide, ichimlik: d.ichimlik, shirinlik: d.shirinlik
            };
            const filterBar = document.getElementById('filterBar');
            if (filterBar) filterBar.innerHTML = cats.map(c => `<button class="filter-btn ${c === currentCategory ? 'active' : ''}" onclick="filterMenu('${c}',this)">${catNames[c]}</button>`).join('');

            document.getElementById('heroDesc').innerHTML = d.heroDesc;
            document.getElementById('ctaBtn').innerHTML = d.ctaBtn;
            document.getElementById('checkoutBtn').innerHTML = d.cartBtnText;
            const selectFromMapBtn = document.getElementById('selectFromMapBtn');
            if (selectFromMapBtn) selectFromMapBtn.innerHTML = d.selectFromMap;

            // Keep TG links clickable even when language text changes.
            const tg1 = document.getElementById('aboutTG1');
            if (tg1) tg1.href = 'https://t.me/AHMADBEKrestogroup';
            const tg2 = document.getElementById('aboutTG2');
            if (tg2) tg2.href = 'https://t.me/odilovabdulquddus';

            createProfileDropdown();
            displayProducts(currentCategory);
            displayRooms();
            if (document.getElementById('myOrdersPanel').classList.contains('active')) displayMyOrders();
            if (document.getElementById('cartPanel').classList.contains('active')) { updateCart(); if (currentStep === 'checkout') updateCheckoutSummary(); }
            if (document.getElementById('mapModal')?.classList.contains('active')) {
                updateMapUiText();
                renderLayersPanel();
            }
        }

        // ==================== ISHGA TUSHIRISH ====================
        async function bootstrap() {
            if (window.__appBootstrapped) return;
            window.__appBootstrapped = true;

            await includePartials();
            await loadProductsData();
            await loadRoomsData();

            setInterval(updateOnlineUsers, 10000);
            window.addEventListener('beforeunload', () => {
                let list = readJSONFromLocalStorage('onlineUsers', []) || [];
                list = list.filter(u => u.id !== userId);
                localStorage.setItem('onlineUsers', JSON.stringify(list));
            });
            updateOnlineUsers();

            document.getElementById('courierDelivery')?.addEventListener('change', () => {
                refreshCheckoutAddressSection();
                updateCheckoutSummary();
                validateAddress(false);
            });
            document.getElementById('addressInput')?.addEventListener('input', () => validateAddress(false));
            document.getElementById('addressInput')?.addEventListener('blur', () => validateAddress(true));
            refreshCheckoutAddressSection();

            loadCartState();
            createProfileDropdown();
            changeLang('uz');
            await restoreBackendSession();
            await loadOrdersData();
            updateCart();
            updateProfileDropdown();
            updateCheckoutForm();
            updateLoginRequiredMessage();
            pruneExpiredBookings();
            displayRooms();
            scheduleRoomDateRefresh();
            setInterval(updateMobileBadges, 5000);
            document.getElementById('roomStartTime')?.addEventListener('input', refreshRoomConflictHint);
            document.getElementById('roomEndTime')?.addEventListener('input', refreshRoomConflictHint);
            document.getElementById('roomDate')?.addEventListener('change', () => { populateRoomSelector(); refreshRoomConflictHint(); });

	            const imageModal = document.getElementById('imageModal');
	            if (imageModal) {
	                imageModal.addEventListener('click', (e) => {
	                    if (e.target === imageModal) closeImageModal();
	                });
	            }

                document.addEventListener('click', (e) => {
                    const profileContainer = document.querySelector('.profile-container');
                    if (profileContainer && !profileContainer.contains(e.target)) {
                        closeProfileDropdown();
                    }
                });

                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') closeAllUiOverlays();
                });

            window.onscroll = () => {
                document.getElementById('scrollToTop')?.classList.toggle('show', document.body.scrollTop > 200 || document.documentElement.scrollTop > 200);
            };
        }

        document.addEventListener('DOMContentLoaded', () => {
            bootstrap().catch((err) => console.error('bootstrap failed', err));
        });
    
