import { useEffect, useRef, useState } from "react";
import { createChart, LineSeries, ColorType } from "lightweight-charts";
import { number } from "./StockHeader";
export default function StockChart({ prices, currency }) {
  const container = useRef(null);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    const chart = createChart(container.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#10161b" },
        textColor: "#87959f",
        fontFamily: "'SFMono-Regular', Consolas, monospace",
        fontSize: 11,
        attributionLogo: true,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "#20292f", style: 2 },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.13, bottom: 0.12 },
      },
      timeScale: {
        borderColor: "#273138",
        timeVisible: false,
        rightOffset: 4,
        // Allow decades of daily bars to fit even on a narrow phone screen.
        minBarSpacing: 0.001,
      },
      crosshair: {
        mode: 0,
        vertLine: { color: "#61776c", labelBackgroundColor: "#284b3d" },
        horzLine: { color: "#61776c", labelBackgroundColor: "#284b3d" },
      },
      localization: { priceFormatter: (price) => number(price) },
    });
    const series = chart.addSeries(LineSeries, {
      color: "#9cdbad",
      lineWidth: 2,
      priceLineVisible: false,
      crosshairMarkerRadius: 5,
    });
    series.setData(prices.map((p) => ({ time: p.time, value: p.close })));
    chart.timeScale().fitContent();
    let resizeFrame;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => chart.timeScale().fitContent());
    });
    observer.observe(container.current);
    chart.subscribeCrosshairMove((param) => {
      const point = param.seriesData.get(series);
      const time = param.time;
      setHover(
        point && time
          ? {
              value: point.value,
              time:
                typeof time === "string"
                  ? time
                  : `${time.year}-${String(time.month).padStart(2, "0")}-${String(time.day).padStart(2, "0")}`,
            }
          : null,
      );
    });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(resizeFrame);
      chart.remove();
    };
  }, [prices]);
  return (
    <>
      <div className="chart-legend">
        <span className="legend-dot" />
        Adjusted close{" "}
        <span className="mono">
          {hover
            ? `${hover.time} · ${number(hover.value)} ${currency || ""}`
            : "Hover to inspect a session"}
        </span>
      </div>
      <div
        className="chart-canvas"
        ref={container}
        role="img"
        aria-label={`Interactive historical closing-price chart. ${prices.length} trading sessions, from ${prices[0].time} to ${prices.at(-1).time}. Latest close ${number(prices.at(-1).close)} ${currency || ""}.`}
      />
    </>
  );
}
