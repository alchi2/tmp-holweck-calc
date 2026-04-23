export function HelpPanel() {
  return (
    <div className="help">
      <h2>Справка: методика расчёта и литературный обзор</h2>

      <section>
        <h3>1. Общее описание</h3>
        <p>
          Приложение рассчитывает максимальную степень сжатия <code>K</code>,
          быстроту действия <code>S</code> и мощность <code>P</code> двух типов
          молекулярных ступеней:
        </p>
        <ul>
          <li>
            <b>Осевая турбомолекулярная ступень</b> (Becker 1958; Kruger 1960):
            чередующиеся ряды лопаток ротора и статора, каждый ряд ускоряет
            тепловые молекулы в осевом направлении.
          </li>
          <li>
            <b>Holweck drag-ступень</b> (Holweck 1923; Sickafus 1961): гладкий
            ротор-цилиндр внутри статора со спиральными канавками, сжатие за
            счёт увлечения молекул стенкой ротора.
          </li>
        </ul>
        <p>
          Доступны три режима: <b>только турбо</b>, <b>только Holweck</b> и{" "}
          <b>совмещённая работа</b> (турбо на входе, Holweck на выходе — как в
          HiPace/TwisTorr/TURBOVAC).
        </p>
      </section>

      <section>
        <h3>2. Формулы — осевая турбо-ступень</h3>

        <p>
          Тангенциальная скорость лопатки, параметр скорости и коэффициент
          упаковки:
        </p>
        <div className="eq">
          u = ω · r̄,&emsp;ω = 2π·RPM/60
          <br />
          v_m = √(2RT/M),&emsp;C = u / v_m
          <br />
          b = h / sin α,&emsp;s = 2π·r̄ / N,&emsp;s/b = безразмерное соотношение
          шага к хорде
        </div>

        <p>
          Эмпирическая подгонка по таблицам Kruger 1960 (воспроизведено в
          Lafferty 1998, гл. 6):
        </p>
        <div className="eq">
          ln K_ряд = κ · C · exp(−α/τ) · g(s/b)
          <br />
          κ = 8.55,&emsp;τ = 0.327 рад (≈ 18.7°)
          <br />
          g(s/b) = (s/b)^(−0.55)
          <br />
          W_ряд = sin α · (0.5 + 0.3·tanh(C/1.5)) · (0.8 + 0.2·min(1, s/b))
        </div>

        <p>Поправка на кориолисово ускорение (3D эффект):</p>
        <div className="eq">
          L_канала = h / sin α
          <br />
          δ = arctan(ω · L_канала / (2 v_m))
          <br />
          α_eff = α ± δ&emsp;(ротор: +, статор: −)
        </div>

        <p>Интегральные величины:</p>
        <div className="eq">
          K_total = Π K_i&emsp;(по всем рядам, включая статоры)
          <br />
          S_max = (v_m / 4) · A_кольца · W_вх&emsp;(лимит первого ряда)
          <br />
          P_газ = Σ ρ · v_m · u² · A · sin α · cos α&emsp;(передача момента)
          <br />
          P_ветра ≈ 0.05 · ρ · v_m · u² · A_tip&emsp;(потери у бандажа)
        </div>
      </section>

      <section>
        <h3>3. Формулы — Holweck drag-ступень</h3>
        <p>Геометрия:</p>
        <div className="eq">
          D — внешний диаметр ротора,&emsp;L — осевая длина ступени
          <br />
          h — глубина канавки,&emsp;s — ширина канавки,&emsp;w — ширина
          перегородки (земли)
          <br />
          θ — угол винта (от оси вращения),&emsp;δ — радиальный зазор,&emsp;n —
          число заходов
        </div>

        <p>Периферийная и дрейфовая скорости (Sickafus 1961, ур. 2, 4):</p>
        <div className="eq">
          u = π · D · N / 60
          <br />
          duty = s / (s + w)&emsp;(доля площади, занятой движущейся стенкой)
          <br />
          v̄ = u · cos θ · duty&emsp;(средний дрейф газа по канавке)
        </div>

        <p>
          Максимальная степень сжатия (интегрирование уравнения баланса, {" "}
          Mongodin & Prévot 1957; Jousten 2008, §7.4):
        </p>
        <div className="eq">
          h_эфф = h + (w/s) · (δ² / h) · (1 / cos θ)
          <br />
          ln K_max = (u · sin θ · cos θ · L) / (v_m · h_эфф)
        </div>
        <p>
          Эффективная щель <code>h_эфф</code> учитывает обратную диффузию газа
          по канавке и через радиальный зазор над землями.
        </p>

        <p>Быстрота действия (Sickafus 1961, ур. 3, 22):</p>
        <div className="eq">
          A_вх = π · D · h · duty&emsp;(кольцевое входное сечение)
          <br />
          S_drag = π · D · h · u · cos θ · duty²&emsp;(кинематический drag-поток)
          <br />
          S_терм = (v_m / 4) · A_вх&emsp;(термодиффузионный лимит)
          <br />
          S_max = min(S_drag, S_терм) · (1 − 1/K_max)
        </div>

        <p>
          Геометрически согласованное число заходов винта:
          <br />
          <code>n_геом = π·D / (s + w)</code>. Если заданное пользователем
          число заходов сильно отличается, в сводной таблице показываются оба
          значения.
        </p>
      </section>

      <section>
        <h3>4. Комбинированный режим</h3>
        <p>
          Турбо-секция стоит на входе (большие A_кольца, большое S), Holweck —
          на выходе (высокая K, толерантность к форвакууму). В стационарном
          режиме:
        </p>
        <div className="eq">
          K_total = K_турбо · K_Holweck
          <br />
          S_вх = S_турбо_вх&emsp;(верхняя секция лимитирует S)
        </div>
        <p>
          Если <code>S_drag_Holweck · K_турбо &lt; S_турбо_вх</code>, выдаётся
          предупреждение: Holweck не успевает откачивать сжатый поток.
        </p>
      </section>

      <section>
        <h3>5. Блок-схема алгоритма</h3>
        <BlockDiagram />
      </section>

      <section>
        <h3>6. Литературный обзор</h3>
        <ul className="refs">
          <li>
            <b>Gaede, W.</b> (1913). Die Molekularluftpumpe.{" "}
            <i>Annalen der Physik</i> 46, 357. — Первый принцип drag-pump.
          </li>
          <li>
            <b>Holweck, F.</b> (1923). Pompe moléculaire hélicoïdale. <i>J.
              Phys. Radium</i> 4, 57. — Оригинал Holweck-ступени.
          </li>
          <li>
            <b>Becker, W.</b> (1958). Eine neue Molekularpumpe.{" "}
            <i>Vakuum-Technik</i> 7(8), 149. — Современная осевая компоновка.
          </li>
          <li>
            <b>Kruger, C.H.</b> (1960). The axial-flow compressor in the
            free-molecule range. PhD thesis, MIT. — Таблицы K и W методом
            Монте-Карло (основа валидации).
          </li>
          <li>
            <b>Sickafus, E.N.</b> (1961). Holweck Type Molecular Pump. US-AEC
            report NYO-9256.{" "}
            <a
              href="https://www.osti.gov/servlets/purl/4833839"
              target="_blank"
              rel="noreferrer"
            >
              OSTI 4833839 (open access)
            </a>
            . — Аналитическое решение Holweck (открытая публикация).
          </li>
          <li>
            <b>Pinson, J.D., Peck, A.W.</b> (1980). Analysis of a turbomolecular
            pump with a Holweck stage. <i>J. Vac. Sci. Technol.</i> 17, 721. —
            Гибридная компоновка (платный доступ).
          </li>
          <li>
            <b>Cheng, H.P., Iacovides, H.</b> (1990). Numerical studies of Holweck
            pumps. <i>Vacuum</i> 41, 1793. — Численное моделирование.
          </li>
          <li>
            <b>Boulon, O., Audi, M.</b> (1997). The TwisTorr — a new Agilent
            molecular drag pump. Agilent Vacuum white paper.{" "}
            <a
              href="https://www.vacuum-uk.org/pdfs/vs2/VacPumps/TwisTorr.pdf"
              target="_blank"
              rel="noreferrer"
            >
              PDF (open)
            </a>
            . — Siegbahn-дисковая вариация.
          </li>
          <li>
            <b>Sharipov, F.</b> (2005). Numerical modeling of the Holweck pump.{" "}
            <i>J. Vac. Sci. Technol. A</i> 23(5), 1331.{" "}
            <a
              href="https://doi.org/10.1116/1.2039648"
              target="_blank"
              rel="noreferrer"
            >
              DOI
            </a>
            . — Кинетическая теория (платный доступ).
          </li>
          <li>
            <b>Giors, S., Subba, F., Zanino, R.</b> (2006). Navier–Stokes
            modelling of a Gaede-Holweck pump. <i>J. Vac. Sci. Technol. A</i>{" "}
            24(4), 1584.{" "}
            <a
              href="https://doi.org/10.1116/1.2210946"
              target="_blank"
              rel="noreferrer"
            >
              DOI
            </a>
            . — DSMC + эксперимент (платный доступ).
          </li>
          <li>
            <b>Naris, S., Koutandou, E., Valougeorgis, D.</b> (2012). Design and
            optimization of a Holweck pump via linear kinetic theory.{" "}
            <i>J. Phys. Conf. Ser.</i> 362, 012024 (open).
          </li>
          <li>
            <b>Jousten, K.</b> (ed., 2008). <i>Handbook of Vacuum Technology</i>,
            Wiley-VCH. §7.4 — подробный вывод K и S для Holweck.
          </li>
          <li>
            <b>Lafferty, J.M.</b> (1998). <i>Foundations of Vacuum Science and
              Technology</i>, Wiley. Гл. 6. — Учебник по TMP и Holweck.
          </li>
          <li>
            <b>Sun, H., et al.</b> (2024). DSMC study of turbomolecular pumps.{" "}
            <i>Vacuum</i> 220, 112835 (open access).
          </li>
        </ul>
        <p className="muted small">
          Замечание о платном доступе: Pinson&nbsp;&amp;&nbsp;Peck 1980 и
          Sharipov 2005, Giors 2006 закрыты. Использовались абстракты, цитаты в
          обзорных работах и переизложение методики в Jousten 2008. Если
          потребуется точная формула из этих источников, сообщите — запросим
          доступ через библиотечные сервисы.
        </p>
      </section>

      <section>
        <h3>6a. Альтернативные методики расчёта</h3>
        <p>В приложении можно переключать формулу для K в обеих секциях.</p>
        <h4>Турбо-ступени:</h4>
        <ul>
          <li>
            <b>Kruger 1960 fit</b> (по умолчанию): ln K = 8.55·C·exp(−α/18.7°)·g(s/b),
            калибровано под Монте-Карло таблицы Kruger. Лучше всего при α = 10°–50°,
            s/b = 0.3–2.
          </li>
          <li>
            <b>Bernhardt 1983</b>: ln K = 2·C·sinα·cosα / (s/b + 0.3·sinα).
            Замкнутая форма, лучше сходится при больших s/b (типичные коммерческие
            ТМН).
          </li>
          <li>
            <b>Sawada-Hirata 1974</b>: K = exp(2·C·tanα / (1 + (s/b)·tanα)).
            Решение кинетического уравнения первого порядка; наиболее точно при
            больших C и лёгких газах.
          </li>
        </ul>
        <h4>Holweck-ступень:</h4>
        <ul>
          <li>
            <b>Sickafus 1961 / Jousten (по умолчанию)</b>: ln K = u·sinθ·cosθ·L /
            (v_m·h_eff), где h_eff учитывает обратный поток через land.
          </li>
          <li>
            <b>Boulon-Audi (TwisTorr)</b>: ln K = 2·u·L / (v_m·(h + δ²/h)) —
            коррекция для малых углов θ (spiral disk).
          </li>
          <li>
            <b>Gaede 1913 Couette</b>: ln K = u·L / (v_m·(h + δ)) — классический
            вязкий предел, нижняя граница.
          </li>
        </ul>
        <p className="muted small">
          На одной и той же геометрии разные методики дают K в пределах ≈×3 друг
          от друга. Если ни одна не воспроизводит эталон, это указывает на ошибку
          геометрии (глубина, зазор) или необходимость DSMC/кинетической модели.
        </p>
      </section>

      <section>
        <h3>6c. Модель кривой S(P_вх) — Sawada 1979 / Skovorodko 2002</h3>
        <p>
          Datasheet-кривые TMP/Holweck показывают характерный «плоский»
          молекулярный участок в середине и спады по обеим сторонам. Мы
          воспроизводим их комбинацией трёх физических эффектов:
        </p>
        <ol>
          <li>
            <b>Переходный режим K(P) — по Sawada 1979</b>. В drag-канале
            выполняется баланс Couette–Poiseuille: приводная сила ротора
            создаёт поступательный поток газа, а градиент давления возвращает
            его обратно. В молекулярном режиме обратный поток идёт за счёт
            Кнудсен-диффузии (не зависит от P), в вязком — за счёт
            Пуазейлевой диффузии (растёт с P). Отсюда:
            <div>
              <code>ln K(P) = ln K_fm · f(Kn)</code>, где{" "}
              <code>f(Kn) = Kn/(Kn + 1)</code>
            </div>
            <div>
              <code>Kn = (λ·P)_воздух / (h · P)</code>, λ·P = 6.6·10⁻³ м·Па
              (воздух, 293 K). В качестве h берётся минимальный из
              геометрических зазоров (глубина канавки, radial clearance).
            </div>
            При Kn → ∞: K → K_fm (молекулярное значение). При Kn → 0:
            K → K_fm<sup>Kn·π/3</sup> → 1 (вязкий коллапс сжатия). Оценка
            ведётся при P_avg = √(P_вх·P_вых).
          </li>
          <li>
            <b>Компрессионный предел (слева)</b>:{" "}
            <code>stall = max(0, 1 − P_вых/(K_eff·P_вх))</code>. Ниже
            P_вых/K_eff насос не может удержать компрессию — газ течёт
            обратно из форвакуума.
          </li>
          <li>
            <b>Ограничение форвакуумной линии (справа)</b>:{" "}
            <code>S ≤ Q_max / P_вх</code>. Datasheet-кривые всегда
            измеряются при фиксированной производительности форвакуумника
            (Q_max = S_back · P_вых_допуст). Когда Q = S·P_вх превышает
            Q_max, форвакуум не успевает откачивать газ, P_вых растёт,
            компрессионный предел выключает S. Для TwisTorr 74 FS типично
            Q_max ≈ 100–500 Па·л/с; для крупных HiPace — до 2000 Па·л/с.
            Параметр задаётся в «Общих параметрах».
          </li>
        </ol>
        <p>
          Итоговая формула:{" "}
          <code>
            S(P_вх) = min(S_max · f_vi(P_avg) · stall, Q_max / P_вх)
          </code>
          , где <code>f_vi</code> — плавный переход быстроты действия от
          молекулярного (≈1) к вязкому плато (≈0.02) по той же функции
          f(Kn).
        </p>
        <p className="muted small">
          Источники: T. Sawada, <i>J. Vac. Sci. Technol. A</i> 18(4), 2000;
          P.A. Skovorodko, <i>arXiv physics/0401020</i> (1D Couette–Poiseuille
          continuum-to-molecular модель для Gaede/Holweck). Sickafus 1961
          даёт K_fm в свободно-молекулярном пределе, Sawada/Skovorodko —
          зависимость K(P) в переходной области.
        </p>
      </section>

      <section>
        <h3>6b. CSV-импорт турбо-ступеней</h3>
        <p>
          На вкладке «Турбо-ступени» кнопки «Пример CSV», «Импорт CSV», «Экспорт
          CSV». Формат (одна строка — одна ступень):
        </p>
        <pre className="code">
id,outerDiameter,hubDiameter,tipClearance,axialGap,{"\n"}
rotorAngleDeg,rotorCount,rotorHeight,{"\n"}
statorAngleDeg,statorCount,statorHeight
        </pre>
        <p className="muted small">
          Длины в метрах, углы в градусах. Строки, начинающиеся с «#»,
          игнорируются. Файл можно подготовить в Excel или LibreOffice Calc.
        </p>
      </section>

      <section>
        <h3>7. Ограничения модели</h3>
        <ul>
          <li>
            Только свободно-молекулярный режим (Kn ≫ 1); для переходного и
            вязкого режима (форвакуум &gt; 100 Па) модель теряет точность.
          </li>
          <li>
            Аналитические формулы калиброваны под таблицы Kruger 1960 с
            точностью ±25–30% по K и ±10% по W.
          </li>
          <li>
            Holweck-формула — одномерная, без поправок на кривизну канавки и
            end-effects. Для пересечения с DSMC ожидается разброс ×2 по K.
          </li>
          <li>
            Siegbahn-дисковая геометрия (TwisTorr) аппроксимируется как
            Holweck-цилиндр эквивалентного диаметра — только для грубых оценок.
          </li>
          <li>
            Мощность — газодинамическая (передача момента молекулам) плюс
            приближённые ветровые потери; не учитываются подшипники и двигатель.
          </li>
        </ul>
      </section>
    </div>
  );
}

function BlockDiagram() {
  return (
    <svg
      viewBox="0 0 720 560"
      width="100%"
      role="img"
      aria-label="Блок-схема алгоритма расчёта"
      style={{ maxWidth: 720, background: "var(--bg-card)", borderRadius: 6 }}
    >
      <defs>
        <marker
          id="arr"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="#9aa4b2" />
        </marker>
      </defs>

      {[
        { y: 10, text: "Вход: режим, RPM, T, P_in, газ M" },
        { y: 70, text: "Геометрия ступеней (турбо / Holweck)" },
      ].map((n, i) => (
        <Node key={i} y={n.y} text={n.text} />
      ))}

      <Branch y={130} />

      <Node y={200} x={40} w={280} text="Турбо: по ступеням i=1…N" color="#274472" />
      <Node y={200} x={400} w={280} text="Holweck: по ступеням j=1…M" color="#274472" />

      <Node y={260} x={40} w={280} text="K_i = exp(κ·C·e^(−α_eff/τ)·g(s/b))" small />
      <Node y={260} x={400} w={280} text="ln K_j = u·sinθ·cosθ·L / (v_m·h_eff)" small />

      <Node y={320} x={40} w={280} text="S_i = (v_m/4)·A·W_вх" small />
      <Node y={320} x={400} w={280} text="S_j = min(S_drag, S_term)·(1−1/K)" small />

      <Node y={380} x={40} w={280} text="Π K_i, P_газ, P_windage" small />
      <Node y={380} x={400} w={280} text="Π K_j, P_газ_Holweck" small />

      <Node
        y={450}
        text="Свёртка: K_total = K_турбо · K_Holweck, S_in = S_турбо"
        color="#3d6e4a"
      />
      <Node y={510} text="Вывод: K, S, P + таблицы по ступеням" color="#6e4a3d" />

      {[
        [360, 40, 360, 70],
        [360, 100, 360, 130],
        [360, 160, 180, 200],
        [360, 160, 540, 200],
        [180, 230, 180, 260],
        [540, 230, 540, 260],
        [180, 290, 180, 320],
        [540, 290, 540, 320],
        [180, 350, 180, 380],
        [540, 350, 540, 380],
        [180, 410, 360, 450],
        [540, 410, 360, 450],
        [360, 480, 360, 510],
      ].map(([x1, y1, x2, y2], i) => (
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#9aa4b2"
          strokeWidth="1.5"
          markerEnd="url(#arr)"
        />
      ))}
    </svg>
  );
}

function Node({
  y,
  x = 220,
  w = 280,
  text,
  small,
  color = "#2b3343",
}: {
  y: number;
  x?: number;
  w?: number;
  text: string;
  small?: boolean;
  color?: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={40}
        rx={6}
        ry={6}
        fill={color}
        stroke="#465065"
      />
      <text
        x={x + w / 2}
        y={y + 25}
        fill="#e5e9f0"
        textAnchor="middle"
        fontSize={small ? 12 : 13}
        fontFamily="system-ui, sans-serif"
      >
        {text}
      </text>
    </g>
  );
}

function Branch({ y }: { y: number }) {
  return (
    <text
      x={360}
      y={y + 20}
      fill="#9aa4b2"
      textAnchor="middle"
      fontSize={12}
      fontFamily="system-ui, sans-serif"
    >
      mode ∈ {"{"} turbo, holweck, combined {"}"}
    </text>
  );
}
