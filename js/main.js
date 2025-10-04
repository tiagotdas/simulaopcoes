const App = {
    state: {
        chart: null,
        currentStrategy: 'covered-call',
        tradeLog: [],
    },

    dom: {},

    utils: {
        formatCurrency(value) {
            const colorClass = value >= 0 ? 'text-green-400' : 'text-red-400';
            const formattedValue = `R$ ${value.toFixed(2).replace('.', ',')}`;
            return `<span class="${colorClass}">${formattedValue}</span>`;
        },
        getPrefix(strategy) {
            switch (strategy) {
                case 'covered-call': return 'cc';
                case 'cash-secured-put': return 'csp';
                case 'bear-call-spread': return 'bcs';
                case 'bull-put-spread': return 'bps';
                default: return '';
            }
        }
    },

    validator: {
        validate() {
            const prefix = App.utils.getPrefix(App.state.currentStrategy);
            const form = document.getElementById(`form-${App.state.currentStrategy}`);
            if (!form) return false;

            const numberInputs = form.querySelectorAll('input[type="number"]');
            let isFormValid = true;

            numberInputs.forEach(input => {
                const value = parseFloat(input.value);
                // Valida se é um número, se é positivo, e se a quantidade é maior que zero.
                if (isNaN(value) || value < 0 || (input.id.includes('quantity') && value <= 0)) {
                    input.classList.add('input-invalid');
                    isFormValid = false;
                } else {
                    input.classList.remove('input-invalid');
                }
            });
            return isFormValid;
        }
    },

    calculations: {
        calculateCoveredCall(stockPrice, strike, premium, quantity, expirationPrice) {
            const shares = quantity * 100;
            const stockCost = stockPrice;
            let profitLoss;

            if (expirationPrice <= strike) {
                profitLoss = (expirationPrice - stockCost + premium) * shares;
            } else {
                profitLoss = (strike - stockCost + premium) * shares;
            }

            const maxProfit = (strike - stockCost + premium) * shares;
            const maxLoss = (-stockCost + premium) * shares;
            const breakEven = stockCost - premium;

            return { profitLoss, maxProfit, maxLoss, breakEven };
        },
        calculateCashSecuredPut(strike, premium, quantity, expirationPrice) {
            const shares = quantity * 100;
            let profitLoss;

            if (expirationPrice >= strike) {
                profitLoss = premium * shares;
            } else {
                profitLoss = (expirationPrice - strike + premium) * shares;
            }

            const maxProfit = premium * shares;
            const maxLoss = (-strike + premium) * shares;
            const breakEven = strike - premium;

            return { profitLoss, maxProfit, maxLoss, breakEven };
        },
        calculateBearCallSpread(shortStrike, shortPremium, longStrike, longPremium, quantity, expirationPrice) {
            const shares = quantity * 100;
            const netPremium = shortPremium - longPremium;
            let profitLoss;

            if (expirationPrice <= shortStrike) {
                profitLoss = netPremium * shares;
            } else if (expirationPrice > shortStrike && expirationPrice < longStrike) {
                profitLoss = (-(expirationPrice - shortStrike) + netPremium) * shares;
            } else {
                profitLoss = (-(longStrike - shortStrike) + netPremium) * shares;
            }

            const maxProfit = netPremium * shares;
            const maxLoss = (-(longStrike - shortStrike) + netPremium) * shares;
            const breakEven = shortStrike + netPremium;

            return { profitLoss, maxProfit, maxLoss, breakEven };
        },
        calculateBullPutSpread(shortStrike, shortPremium, longStrike, longPremium, quantity, expirationPrice) {
            const shares = quantity * 100;
            const netPremium = shortPremium - longPremium;
            let profitLoss;

            if (expirationPrice >= shortStrike) {
                profitLoss = netPremium * shares;
            } else if (expirationPrice < shortStrike && expirationPrice > longStrike) {
                profitLoss = ((expirationPrice - shortStrike) + netPremium) * shares;
            } else {
                profitLoss = (-(shortStrike - longStrike) + netPremium) * shares;
            }

            const maxProfit = netPremium * shares;
            const maxLoss = (-(shortStrike - longStrike) + netPremium) * shares;
            const breakEven = shortStrike - netPremium;

            return { profitLoss, maxProfit, maxLoss, breakEven };
        }
    },

    ui: {
        updateSliderAndLabel(stockPrice) {
            const min = stockPrice * 0.7;
            const max = stockPrice * 1.3;
            App.dom.expirationPriceSlider.min = min;
            App.dom.expirationPriceSlider.max = max;
            App.dom.expirationPriceSlider.value = stockPrice;
            App.dom.expirationPriceSlider.step = (max - min) / 200;
            App.dom.expirationPriceLabel.textContent = `R$ ${parseFloat(stockPrice).toFixed(2)}`;
        },
        updateTooltips(results, inputs, expirationPrice) {
            const shares = inputs.quantity * 100;
            let pnlTooltip = '', maxProfitTooltip = '', maxLossTooltip = '', breakEvenTooltip = '';

            switch (App.state.currentStrategy) {
                case 'covered-call':
                    pnlTooltip = expirationPrice <= inputs.strike
                        ? `Ação não é exercida. \nResultado = (Preço Final - Preço Ação + Prêmio) * Ações \n(${expirationPrice.toFixed(2)} - ${inputs.stockPrice.toFixed(2)} + ${inputs.premium.toFixed(2)}) * ${shares} = ${results.profitLoss.toFixed(2)}`
                        : `Ação é exercida no strike. \nResultado = (Strike - Preço Ação + Prêmio) * Ações \n(${inputs.strike.toFixed(2)} - ${inputs.stockPrice.toFixed(2)} + ${inputs.premium.toFixed(2)}) * ${shares} = ${results.profitLoss.toFixed(2)}`;
                    maxProfitTooltip = `Lucro máximo se a ação fechar acima do strike. \n(Strike - Preço Ação + Prêmio) * Ações \n(${inputs.strike.toFixed(2)} - ${inputs.stockPrice.toFixed(2)} + ${inputs.premium.toFixed(2)}) * ${shares} = ${results.maxProfit.toFixed(2)}`;
                    maxLossTooltip = `Prejuízo se a ação cair. Teoricamente ilimitado para baixo, mas limitado a zero. \n(-Preço Ação + Prêmio) * Ações \n(-${inputs.stockPrice.toFixed(2)} + ${inputs.premium.toFixed(2)}) * ${shares} = ${results.maxLoss.toFixed(2)}`;
                    breakEvenTooltip = `Preço da ação no qual a operação zera. \nPreço Ação - Prêmio \n${inputs.stockPrice.toFixed(2)} - ${inputs.premium.toFixed(2)} = ${results.breakEven.toFixed(2)}`;
                    break;
                case 'cash-secured-put':
                     pnlTooltip = expirationPrice >= inputs.strike
                        ? `Opção vira pó. \nResultado = Prêmio * Ações \n${inputs.premium.toFixed(2)} * ${shares} = ${results.profitLoss.toFixed(2)}`
                        : `Obrigado a comprar a ação no strike. \nResultado = (Preço Final - Strike + Prêmio) * Ações \n(${expirationPrice.toFixed(2)} - ${inputs.strike.toFixed(2)} + ${inputs.premium.toFixed(2)}) * ${shares} = ${results.profitLoss.toFixed(2)}`;
                    maxProfitTooltip = `Lucro máximo é o prêmio, se a ação fechar acima do strike. \nPrêmio * Ações \n${inputs.premium.toFixed(2)} * ${shares} = ${results.maxProfit.toFixed(2)}`;
                    maxLossTooltip = `Prejuízo se a ação cair abaixo do break-even. \n(-Strike + Prêmio) * Ações \n(-${inputs.strike.toFixed(2)} + ${inputs.premium.toFixed(2)}) * ${shares} = ${results.maxLoss.toFixed(2)}`;
                    breakEvenTooltip = `Preço da ação no qual a operação zera. \nStrike - Prêmio \n${inputs.strike.toFixed(2)} - ${inputs.premium.toFixed(2)} = ${results.breakEven.toFixed(2)}`;
                    break;
                case 'bear-call-spread':
                    const bcsNetPremium = inputs.shortPremium - inputs.longPremium;
                    maxProfitTooltip = `Lucro máximo é o crédito recebido, se a ação fechar abaixo do strike vendido (${inputs.shortStrike.toFixed(2)}). \nCrédito Líquido * Ações \n${bcsNetPremium.toFixed(2)} * ${shares} = ${results.maxProfit.toFixed(2)}`;
                    maxLossTooltip = `Prejuízo máximo é travado se a ação fechar acima do strike comprado (${inputs.longStrike.toFixed(2)}). \n(Strike Vendido - Strike Comprado + Crédito) * Ações \n(${inputs.shortStrike.toFixed(2)} - ${inputs.longStrike.toFixed(2)} + ${bcsNetPremium.toFixed(2)}) * ${shares} = ${results.maxLoss.toFixed(2)}`;
                    breakEvenTooltip = `Ponto de equilíbrio da operação. \nStrike Vendido + Crédito Líquido \n${inputs.shortStrike.toFixed(2)} + ${bcsNetPremium.toFixed(2)} = ${results.breakEven.toFixed(2)}`;
                    pnlTooltip = `O resultado depende do preço final em relação aos strikes. O lucro é máximo abaixo de ${inputs.shortStrike.toFixed(2)} e o prejuízo é máximo acima de ${inputs.longStrike.toFixed(2)}.`;
                    break;
                case 'bull-put-spread':
                    const bpsNetPremium = inputs.shortPremium - inputs.longPremium;
                    maxProfitTooltip = `Lucro máximo é o crédito recebido, se a ação fechar acima do strike vendido (${inputs.shortStrike.toFixed(2)}). \nCrédito Líquido * Ações \n${bpsNetPremium.toFixed(2)} * ${shares} = ${results.maxProfit.toFixed(2)}`;
                    maxLossTooltip = `Prejuízo máximo é travado se a ação fechar abaixo do strike comprado (${inputs.longStrike.toFixed(2)}). \n(Strike Comprado - Strike Vendido + Crédito) * Ações \n(${inputs.longStrike.toFixed(2)} - ${inputs.shortStrike.toFixed(2)} + ${bpsNetPremium.toFixed(2)}) * ${shares} = ${results.maxLoss.toFixed(2)}`;
                    breakEvenTooltip = `Ponto de equilíbrio da operação. \nStrike Vendido - Crédito Líquido \n${inputs.shortStrike.toFixed(2)} - ${bpsNetPremium.toFixed(2)} = ${results.breakEven.toFixed(2)}`;
                    pnlTooltip = `O resultado depende do preço final em relação aos strikes. O lucro é máximo acima de ${inputs.shortStrike.toFixed(2)} e o prejuízo é máximo abaixo de ${inputs.longStrike.toFixed(2)}.`;
                    break;
            }
            App.dom.pnlCard.title = pnlTooltip;
            App.dom.maxProfitCard.title = maxProfitTooltip;
            App.dom.maxLossCard.title = maxLossTooltip;
            App.dom.breakEvenCard.title = breakEvenTooltip;
        },
        update() {
            if (!App.validator.validate()) {
                return;
            }

            const expirationPrice = parseFloat(App.dom.expirationPriceSlider.value);
            App.dom.expirationPriceLabel.textContent = `R$ ${expirationPrice.toFixed(2)}`;

            const inputs = App.handlers.getInputs();

            let results;
            const strategyCalc = {
                'covered-call': App.calculations.calculateCoveredCall(inputs.stockPrice, inputs.strike, inputs.premium, inputs.quantity, expirationPrice),
                'cash-secured-put': App.calculations.calculateCashSecuredPut(inputs.strike, inputs.premium, inputs.quantity, expirationPrice),
                'bear-call-spread': App.calculations.calculateBearCallSpread(inputs.shortStrike, inputs.shortPremium, inputs.longStrike, inputs.longPremium, inputs.quantity, expirationPrice),
                'bull-put-spread': App.calculations.calculateBullPutSpread(inputs.shortStrike, inputs.shortPremium, inputs.longStrike, inputs.longPremium, inputs.quantity, expirationPrice),
            };
            results = strategyCalc[App.state.currentStrategy];

            App.dom.pnlEl.innerHTML = App.utils.formatCurrency(results.profitLoss);
            App.dom.maxProfitEl.innerHTML = App.utils.formatCurrency(results.maxProfit);
            App.dom.maxLossEl.innerHTML = App.utils.formatCurrency(results.maxLoss);
            App.dom.breakEvenEl.innerHTML = `R$ ${results.breakEven.toFixed(2).replace('.', ',')}`;

            App.ui.updateTooltips(results, inputs, expirationPrice);
            App.chartManager.update();
        }
    },

    chartManager: {
        create() {
            const ctx = App.dom.chartCanvas.getContext('2d');
            App.state.chart = new Chart(ctx, {
                type: 'line',
                data: { labels: [], datasets: [{ label: 'Lucro / Prejuízo (R$)', data: [], fill: false, borderWidth: 2, tension: 0.1, pointRadius: 0 }] },
                options: {
                    responsive: true, maintainAspectRatio: true,
                    scales: {
                        y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
                        x: { ticks: { color: '#9ca3af', maxRotation: 0, minRotation: 0, autoSkip: true, maxTicksLimit: 10 }, grid: { color: 'rgba(255, 255, 255, 0.1)' } }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context) => `P/L: R$ ${parseFloat(context.raw).toFixed(2)}`,
                                title: (context) => `Preço no Vencimento: R$ ${context[0].label}`
                            }
                        }
                    }
                }
            });
        },
        update() {
            const inputs = App.handlers.getInputs();
            if (!App.validator.validate()) return;

            const minPrice = parseFloat(App.dom.expirationPriceSlider.min);
            const maxPrice = parseFloat(App.dom.expirationPriceSlider.max);
            const labels = [];
            const data = [];

            for (let p = minPrice; p <= maxPrice; p += (maxPrice - minPrice) / 50) {
                labels.push(p.toFixed(2));
                let result;
                 const strategyCalc = {
                    'covered-call': App.calculations.calculateCoveredCall(inputs.stockPrice, inputs.strike, inputs.premium, inputs.quantity, p),
                    'cash-secured-put': App.calculations.calculateCashSecuredPut(inputs.strike, inputs.premium, inputs.quantity, p),
                    'bear-call-spread': App.calculations.calculateBearCallSpread(inputs.shortStrike, inputs.shortPremium, inputs.longStrike, inputs.longPremium, inputs.quantity, p),
                    'bull-put-spread': App.calculations.calculateBullPutSpread(inputs.shortStrike, inputs.shortPremium, inputs.longStrike, inputs.longPremium, inputs.quantity, p),
                };
                result = strategyCalc[App.state.currentStrategy];
                data.push(result.profitLoss.toFixed(2));
            }

            App.state.chart.data.labels = labels;
            App.state.chart.data.datasets[0].data = data;
            App.state.chart.data.datasets[0].borderColor = data.map(v => v >= 0 ? 'rgba(74, 222, 128, 1)' : 'rgba(248, 113, 113, 1)');
            App.state.chart.update();
        }
    },

    tradeLogger: {
        save() {
            localStorage.setItem('optionsSimulatorTrades', JSON.stringify(App.state.tradeLog));
        },
        addTradeToTable(trade) {
            const newRow = document.createElement('tr');
            newRow.className = 'bg-gray-800 border-b border-gray-700 hover:bg-gray-600';
            newRow.innerHTML = `
                <td class="px-4 py-3">${trade.strategyName}</td>
                <td class="px-4 py-3 font-medium text-white">${trade.ticker.toUpperCase()}</td>
                <td class="px-4 py-3">${trade.params}</td>
                <td class="px-4 py-3">${App.utils.formatCurrency(trade.credit)}</td>
                <td class="px-4 py-3">${App.utils.formatCurrency(trade.profitLoss)}</td>`;
            App.dom.tradeLogBody.appendChild(newRow);
        },
        updateTotalPnl() {
            const total = App.state.tradeLog.reduce((acc, trade) => acc + trade.profitLoss, 0);
            App.dom.totalPnlEl.innerHTML = App.utils.formatCurrency(total);
        },
        load() {
            const savedTrades = localStorage.getItem('optionsSimulatorTrades');
            if (savedTrades) {
                App.state.tradeLog = JSON.parse(savedTrades);
                App.dom.tradeLogBody.innerHTML = '';
                App.state.tradeLog.forEach(trade => this.addTradeToTable(trade));
                this.updateTotalPnl();
            }
        },
        clear() {
            if (confirm('Tem certeza que deseja limpar todo o diário de operações?')) {
                App.state.tradeLog = [];
                App.dom.tradeLogBody.innerHTML = '';
                this.save();
                this.updateTotalPnl();
            }
        },
        log() {
            if (!App.validator.validate()) {
                 alert("Por favor, preencha todos os campos corretamente com números positivos antes de registrar.");
                return;
            }

            const inputs = App.handlers.getInputs();
            const expirationPrice = parseFloat(App.dom.expirationPriceSlider.value);
            let results, strategyName, params, credit;

            switch (App.state.currentStrategy) {
                case 'covered-call':
                    results = App.calculations.calculateCoveredCall(inputs.stockPrice, inputs.strike, inputs.premium, inputs.quantity, expirationPrice);
                    strategyName = "Venda Coberta";
                    params = `Strike: ${inputs.strike.toFixed(2)}`;
                    credit = inputs.premium * 100 * inputs.quantity;
                    break;
                case 'cash-secured-put':
                    results = App.calculations.calculateCashSecuredPut(inputs.strike, inputs.premium, inputs.quantity, expirationPrice);
                    strategyName = "Venda de Put";
                    params = `Strike: ${inputs.strike.toFixed(2)}`;
                    credit = inputs.premium * 100 * inputs.quantity;
                    break;
                case 'bear-call-spread':
                    results = App.calculations.calculateBearCallSpread(inputs.shortStrike, inputs.shortPremium, inputs.longStrike, inputs.longPremium, inputs.quantity, expirationPrice);
                    strategyName = "Trava de Baixa";
                    params = `Strikes: ${inputs.shortStrike.toFixed(2)}/${inputs.longStrike.toFixed(2)}`;
                    credit = (inputs.shortPremium - inputs.longPremium) * 100 * inputs.quantity;
                    break;
                case 'bull-put-spread':
                    results = App.calculations.calculateBullPutSpread(inputs.shortStrike, inputs.shortPremium, inputs.longStrike, inputs.longPremium, inputs.quantity, expirationPrice);
                    strategyName = "Trava de Alta";
                    params = `Strikes: ${inputs.shortStrike.toFixed(2)}/${inputs.longStrike.toFixed(2)}`;
                    credit = (inputs.shortPremium - inputs.longPremium) * 100 * inputs.quantity;
                    break;
            }

            const tradeData = { strategyName, ticker: inputs.ticker, params, credit, profitLoss: results.profitLoss };
            App.state.tradeLog.push(tradeData);
            this.addTradeToTable(tradeData);
            this.save();
            this.updateTotalPnl();
        }
    },

    handlers: {
        getInputs() {
            const prefix = App.utils.getPrefix(App.state.currentStrategy);
            const quantity = parseFloat(document.getElementById(`${prefix}-quantity`)?.value);
            const stockPrice = parseFloat(document.getElementById(`${prefix}-stock-price`).value);

            const commonInputs = {
                ticker: document.getElementById(`${prefix}-ticker`).value,
                stockPrice: stockPrice,
                quantity: quantity
            };

            if (App.state.currentStrategy === 'covered-call' || App.state.currentStrategy === 'cash-secured-put') {
                return {
                    ...commonInputs,
                    strike: parseFloat(document.getElementById(`${prefix}-strike`).value),
                    premium: parseFloat(document.getElementById(`${prefix}-premium`).value),
                };
            } else {
                return {
                    ...commonInputs,
                    shortStrike: parseFloat(document.getElementById(`${prefix}-short-strike`).value),
                    shortPremium: parseFloat(document.getElementById(`${prefix}-short-premium`).value),
                    longStrike: parseFloat(document.getElementById(`${prefix}-long-strike`).value),
                    longPremium: parseFloat(document.getElementById(`${prefix}-long-premium`).value),
                };
            }
        },
        handleTabClick(e) {
            const tab = e.target;
            App.dom.tabs.forEach(t => t.classList.remove('tab-active'));
            tab.classList.add('tab-active');

            App.state.currentStrategy = tab.id.replace('tab-', '');

            App.dom.forms.forEach(form => form.classList.add('hidden'));
            document.getElementById(`form-${App.state.currentStrategy}`).classList.remove('hidden');

            const prefix = App.utils.getPrefix(App.state.currentStrategy);
            const stockPriceInput = document.getElementById(`${prefix}-stock-price`);
            if (stockPriceInput && stockPriceInput.value) {
                App.ui.updateSliderAndLabel(parseFloat(stockPriceInput.value));
            }
            App.ui.update();
        },
        handleStockPriceChange(e) {
            if(e.target.value) {
                App.ui.updateSliderAndLabel(parseFloat(e.target.value));
                App.ui.update();
            }
        }
    },

    bindEvents() {
        App.dom.tabs.forEach(tab => tab.addEventListener('click', App.handlers.handleTabClick));
        App.dom.allInputs.forEach(input => {
            input.addEventListener('input', App.ui.update);
        });
        App.dom.stockPriceInputs.forEach(input => input.addEventListener('change', App.handlers.handleStockPriceChange));
        App.dom.logTradeBtn.addEventListener('click', App.tradeLogger.log.bind(App.tradeLogger));
        App.dom.clearLogBtn.addEventListener('click', App.tradeLogger.clear.bind(App.tradeLogger));
    },

    cacheDom() {
        App.dom = {
            tabs: document.querySelectorAll('.tab-btn'),
            forms: document.querySelectorAll('.strategy-form'),
            expirationPriceSlider: document.getElementById('expiration-price'),
            expirationPriceLabel: document.getElementById('expiration-price-label'),
            pnlEl: document.getElementById('pnl'),
            maxProfitEl: document.getElementById('max-profit'),
            maxLossEl: document.getElementById('max-loss'),
            breakEvenEl: document.getElementById('break-even'),
            pnlCard: document.getElementById('pnl-card'),
            maxProfitCard: document.getElementById('max-profit-card'),
            maxLossCard: document.getElementById('max-loss-card'),
            breakEvenCard: document.getElementById('break-even-card'),
            logTradeBtn: document.getElementById('log-trade-btn'),
            tradeLogBody: document.getElementById('trade-log-body'),
            totalPnlEl: document.getElementById('total-pnl'),
            clearLogBtn: document.getElementById('clear-log-btn'),
            chartCanvas: document.getElementById('payoff-chart'),
            allInputs: document.querySelectorAll('input[type="number"], input[type="range"]'),
            stockPriceInputs: document.querySelectorAll('input[id$="-stock-price"]'),
        };
    },

    init() {
        this.cacheDom();
        this.bindEvents();
        this.chartManager.create();
        this.tradeLogger.load();

        // Valida os campos iniciais ao carregar a página
        App.validator.validate();

        const initialStockPrice = parseFloat(document.getElementById('cc-stock-price').value);
        if(!isNaN(initialStockPrice)) {
            this.ui.updateSliderAndLabel(initialStockPrice);
            this.ui.update();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());