const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

puppeteer.use(StealthPlugin());
const app = express();
app.use(cors());
app.use(express.json());

const SITE_URL = 'https://getflix-phi.vercel.app/';

// CONFIGURAÇÃO DO PROXY RESIDENCIAL PREMIUM
const PROXY_HOST = 'residential.proxora.io';
const PROXY_PORT = '12321';
const PROXY_USER = '88612c34bc4a';
const PROXY_PASS = '27ca2a2cebe9_country-us';

const randomDelay = (min, max) => new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1) + min)));

let isProcessing = false;
let lastExecutions = [];
const MAX_CALLS_PER_30S = 2;

// 1. Buscar Proxies (Agora gera o link com o proxy premium)
async function fetchProxies() {
    // Para forçar a troca de IP a cada acesso, adicionamos um ID de sessão aleatório no usuário.
    // (Se o Proxora não suportar sessões, ele vai ignorar e usar a rotação padrão).
    const sessionId = Math.floor(Math.random() * 1000000);
    const proxyUrl = `http://${PROXY_USER}_session-${sessionId}:${PROXY_PASS}@${PROXY_HOST}:${PROXY_PORT}`;
    
    console.log(`✅ Proxy residencial premium configurado!`);
    return [proxyUrl];
}

// 2. Validação rápida (Aumentada para 10s pois residenciais podem demorar um pouco a conectar)
async function proxyEstaVivo(proxyUrl, testUrl = SITE_URL, timeout = 10000) {
    try {
        const agent = new HttpsProxyAgent(proxyUrl);
        await axios.get(testUrl, {
            httpAgent: agent,
            httpsAgent: agent,
            timeout: timeout,
            maxRedirects: 0,
            validateStatus: () => true
        });
        return true;
    } catch (error) {
        console.warn('Erro na validação Axios:', error.message);
        return false;
    }
}

// 3. Função Principal
async function executarSequenciaGetflix() {
    const proxyList = await fetchProxies(); // Sempre vai ter o proxy premium aqui
    
    const maxRetries = 10; 
    
    for (let i = 0; i < maxRetries; i++) {
        const proxy = proxyList[0]; // Pega o proxy premium
        console.log(`\n[${new Date().toLocaleTimeString()}] Tentativa ${i + 1}: Validando proxy residencial...`);
        
        const vivo = await proxyEstaVivo(proxy);
        if (!vivo) {
            console.log(`⏳ Proxy demorou a conectar. Tentando novamente...`);
            await randomDelay(2, 4); // Espera uns segundinhos antes de tentar de novo
            continue;
        }

        console.log(`✅ Proxy validado! Abrindo navegador...`);
        
        let browser;
        let page;
        
        try {
            browser = await puppeteer.launch({
                headless: 'new',
                executablePath: '/usr/bin/google-chrome-stable',
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', `--proxy-server=${proxy}`]
            });

            page = await browser.newPage();
            page.setDefaultTimeout(60000); // 60s de tolerância
            
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
            await page.setViewport({ width: 1366, height: 768 });

            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            });

            // MONITOR DE MONETIZAÇÃO
            browser.on('targetcreated', async (target) => {
                if (target.type() === 'page') {
                    const adPage = await target.page();
                    if (adPage) {
                        try {
                            console.log('💰 [Monetização] Smartlink/Anúncio abriu! Contando impressão...');
                            await randomDelay(2000, 4000);
                            await adPage.close();
                            await page.bringToFront();
                            console.log('🔒 Anúncio fechado. Voltando ao GETFLIX.');
                        } catch (e) {}
                    }
                }
            });

            console.log('Acessando o GETFLIX...');
            await page.goto(SITE_URL, { waitUntil: 'domcontentloaded' });
            await page.waitForSelector('#main-content .mc');

            // FUNÇÕES AUXILIARES BLINDADAS
            const pegarCentroDoSeletor = async (seletor) => {
                return await page.evaluate((sel) => {
                    const el = document.querySelector(sel);
                    if (!el) return null;
                    const rect = el.getBoundingClientRect();
                    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
                }, seletor);
            };

            const pegarCentroDeVarios = async (seletor) => {
                return await page.evaluate((sel) => {
                    const els = Array.from(document.querySelectorAll(sel));
                    return els.map(el => {
                        const rect = el.getBoundingClientRect();
                        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
                    }).filter(b => b.x > 0 && b.y > 0);
                }, seletor);
            };

            const moverMouseRealista = async (x, y) => {
                const steps = 10;
                for (let i = 1; i <= steps; i++) {
                    await page.mouse.move((x / steps) * i + Math.random() * 5, (y / steps) * i + Math.random() * 5);
                    await new Promise(r => setTimeout(r, 10));
                }
            };

            const clicarNasCoordenadas = async (coords) => {
                if (!coords || typeof coords.x !== 'number' || typeof coords.y !== 'number') return;
                try {
                    await moverMouseRealista(coords.x, coords.y);
                    await randomDelay(100, 300);
                    await page.mouse.click(coords.x, coords.y);
                } catch (e) {
                    console.warn('Falha ao clicar:', e.message);
                }
            };

            console.log('✅ Site carregado. Iniciando comportamento humano...');
            await moverMouseRealista(600, 400);
            await randomDelay(1000, 2000);
            
            // BLOCO 1: BUSCA
            try {
                if (Math.random() < 0.3) {
                    console.log('⌨️ Abrindo busca e digitando...');
                    const searchBtn = await pegarCentroDoSeletor('#searchToggle');
                    await clicarNasCoordenadas(searchBtn);
                    await randomDelay(500, 1000);
                    const termos = ['Batman', 'Interestelar', 'Série', 'Anime', 'Terror'];
                    const termo = termos[Math.floor(Math.random() * termos.length)];
                    await page.type('#searchInput', termo, { delay: 100 });
                    await randomDelay(2000, 4000);
                    const closeBtn = await pegarCentroDoSeletor('#searchClose');
                    await clicarNasCoordenadas(closeBtn);
                    await randomDelay(500, 1000);
                }
            } catch (e) { console.warn('Erro na busca:', e.message); }

            await page.evaluate(() => window.scrollBy(0, 600));
            await randomDelay(1000, 3000);

            // BLOCO 2: BANNERS (Foco no Native Banner - 60% chance)
            try {
                if (Math.random() < 0.6) {
                    const bannerCoords = await pegarCentroDeVarios('.ad-native');
                    if (bannerCoords.length > 0) {
                        const target = bannerCoords[Math.floor(Math.random() * bannerCoords.length)];
                        const currentUrl = page.url();
                        await clicarNasCoordenadas(target);
                        await randomDelay(2000, 4000); 
                        if (page.url() !== currentUrl) {
                            await page.goBack({ waitUntil: 'domcontentloaded' });
                            await randomDelay(1000, 2000);
                        }
                    }
                }
            } catch (e) { console.warn('Erro no banner:', e.message); }

            // BLOCO 3: FILME (Aciona Smartlink - Timeout reduzido para 25s para não prender o bot)
            try {
                const filmeCoords = await pegarCentroDeVarios('#main-content .mc');
                if (filmeCoords.length > 0) {
                    const target = filmeCoords[Math.floor(Math.random() * filmeCoords.length)];
                    await clicarNasCoordenadas(target);
                    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 });
                }
            } catch (e) { console.warn('Erro ao clicar no filme (proxy muito lento):', e.message); }

            // BLOCO 4: PLAYER (Foco em mais Native Banners na página do filme - 50% chance)
            try {
                await page.waitForSelector('#mainPlayer', { timeout: 25000 });
                await randomDelay(2000, 4000);
                
                if (Math.random() < 0.5) {
                    const playerBanners = await pegarCentroDeVarios('.ad-sidebar, .ad-native');
                    if (playerBanners.length > 0) {
                        const target = playerBanners[Math.floor(Math.random() * playerBanners.length)];
                        await clicarNasCoordenadas(target);
                        await randomDelay(2000, 3000);
                    }
                }
            } catch (e) { console.warn('Erro no player:', e.message); }

            // BLOCO 5: RECOMENDAÇÕES
            try {
                await page.evaluate(() => {
                    const recs = document.getElementById('recsSection');
                    if (recs) recs.scrollIntoView({ behavior: 'smooth', block: 'center' });
                });
                await randomDelay(2000, 4000);

                const recsCoords = await pegarCentroDeVarios('#recsGrid .mc');
                if (recsCoords.length > 0) {
                    const target = recsCoords[Math.floor(Math.random() * recsCoords.length)];
                    await clicarNasCoordenadas(target);
                    await randomDelay(3000, 8000);
                }
            } catch (e) { console.warn('Erro nas recomendações:', e.message); }

            console.log('🎉 Engajamento concluído com sucesso!');
            break; 
            
        } catch (error) {
            console.warn(`⚠️ Erro fatal ou timeout estourado: ${error.message}`);
        } finally {
            try { if (page) await page.close(); } catch (e) {}
            try { if (browser) await browser.close(); } catch (e) {}
        }
    }
    console.log('Ciclo do bot finalizado.');
}

// --- GESTÃO DA FILA E RATE LIMIT ---
async function processQueue() {
    if (isProcessing) return;
    isProcessing = true;

    while (true) {
        const now = Date.now();
        lastExecutions = lastExecutions.filter(time => now - time < 30000);

        if (lastExecutions.length < MAX_CALLS_PER_30S) {
            lastExecutions.push(now);
            await executarSequenciaGetflix();
        } else {
            const tempoParaEsperar = 30000 - (now - lastExecutions[0]) + 1000;
            console.log(`⏳ Limite de taxa. Aguardando ${Math.round(tempoParaEsperar/1000)}s...`);
            await new Promise(r => setTimeout(r, tempoParaEsperar));
        }
    }
}

// --- ENDPOINTS DA API ---
app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        uptime_seconds: Math.round(process.uptime()),
        is_processing: isProcessing
    });
});

app.post('/api/engajar', async (req, res) => {
    res.status(202).json({ status: 'queued', message: 'Bot na fila.' });
    if (!isProcessing) {
        processQueue();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor de Bot rodando na porta ${PORT}`));
