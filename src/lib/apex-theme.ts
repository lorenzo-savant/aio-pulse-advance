import type { ApexOptions } from 'apexcharts'

export function getHorizonChartOptions(isDark: boolean): ApexOptions {
  return {
    chart: {
      toolbar: { show: false },
      dropShadow: {
        enabled: true,
        top: 13,
        left: 0,
        blur: 10,
        opacity: 0.1,
        color: isDark ? '#7551FF' : '#4318FF',
      },
      background: 'transparent',
      fontFamily: 'DM Sans, sans-serif',
      foreColor: isDark ? '#A3AED0' : '#A3AED0',
    },
    colors: ['#4318FF', '#39B8FF', '#01B574', '#FFB547', '#EE5D50'],
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      style: { fontSize: '12px', fontFamily: 'DM Sans, sans-serif' },
      y: { formatter: (val: number) => `${val}` },
    },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 3 },
    xaxis: {
      labels: {
        style: {
          colors: isDark ? '#A3AED0' : '#A3AED0',
          fontSize: '12px',
          fontWeight: 500,
        },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: {
          colors: isDark ? '#A3AED0' : '#A3AED0',
          fontSize: '12px',
          fontWeight: 500,
        },
      },
    },
    grid: {
      show: true,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
      strokeDashArray: 5,
      yaxis: { lines: { show: true } },
      xaxis: { lines: { show: false } },
      padding: { top: -10, right: 0, bottom: 0, left: 10 },
    },
    fill: {
      type: 'gradient',
      gradient: {
        type: 'vertical',
        shadeIntensity: 1,
        opacityFrom: 0.7,
        opacityTo: 0.0,
        colorStops: [
          [
            { offset: 0, color: '#4318FF', opacity: 0.3 },
            { offset: 100, color: '#4318FF', opacity: 0 },
          ],
        ],
      },
    },
    legend: {
      show: true,
      fontSize: '13px',
      fontFamily: 'DM Sans, sans-serif',
      fontWeight: 500,
      labels: { colors: isDark ? '#CBD5E0' : '#A3AED0' },
      itemMargin: { horizontal: 12 },
    },
    responsive: [{ breakpoint: 768, options: { chart: { height: 250 } } }],
  }
}

export function getHorizonBarOptions(isDark: boolean): ApexOptions {
  const base = getHorizonChartOptions(isDark)
  return {
    ...base,
    chart: { ...base.chart, type: 'bar' },
    plotOptions: {
      bar: {
        borderRadius: 10,
        columnWidth: '40%',
        borderRadiusApplication: 'end',
      },
    },
    fill: {
      type: 'solid',
      colors: ['#4318FF', '#39B8FF'],
    },
  }
}

export function getHorizonLineOptions(isDark: boolean): ApexOptions {
  const base = getHorizonChartOptions(isDark)
  return {
    ...base,
    chart: {
      ...base.chart,
      type: 'line',
      dropShadow: {
        enabled: true,
        top: 5,
        left: 0,
        blur: 6,
        opacity: 0.14,
        color: '#4318FF',
      },
    },
    stroke: { curve: 'smooth', width: 4 },
    markers: { size: 0, strokeWidth: 0 },
  }
}

export function getHorizonPieOptions(isDark: boolean): ApexOptions {
  return {
    chart: {
      type: 'donut',
      background: 'transparent',
      fontFamily: 'DM Sans, sans-serif',
    },
    colors: ['#4318FF', '#6AD2FF', '#01B574', '#FFB547'],
    labels: [],
    dataLabels: { enabled: false },
    legend: {
      show: true,
      position: 'bottom',
      fontSize: '13px',
      fontFamily: 'DM Sans, sans-serif',
      fontWeight: 500,
      labels: { colors: isDark ? '#CBD5E0' : '#A3AED0' },
      itemMargin: { horizontal: 12, vertical: 6 },
    },
    stroke: { show: false },
    plotOptions: {
      pie: {
        donut: {
          size: '65%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Total',
              fontSize: '14px',
              fontFamily: 'DM Sans, sans-serif',
              fontWeight: '500',
              color: isDark ? '#A3AED0' : '#A3AED0',
            },
            value: {
              fontSize: '28px',
              fontFamily: 'DM Sans, sans-serif',
              fontWeight: '700',
              color: isDark ? '#FFFFFF' : '#1B2559',
            },
          },
        },
      },
    },
    responsive: [{ breakpoint: 768, options: { chart: { height: 250 } } }],
  }
}
