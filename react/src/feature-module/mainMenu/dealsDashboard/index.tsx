import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import ReactApexChart from "react-apexcharts";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import dayjs from "dayjs";
import { Chart } from "primereact/chart";
import PredefinedDateRanges from "../../../core/common/datePicker";
import CollapseHeader from "../../../core/common/collapse-header/collapse-header";
import { useSocket } from "../../../SocketContext";
import { useUser } from "@clerk/clerk-react";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import CircleProgress from "../leadsDashboard/circleProgress";

// Type definitions for deals dashboard data
interface DealData {
  totalDeals: number;
  totalDealValue: number;
  wonDeals: number;
  lostDeals: number;
  averageDealSize: number;
  conversionRate: number;
  revenueThisMonth: number;
  activeDeals: number;
  dealsByStage: {
    New: number;
    Prospect: number;
    Proposal: number;
    Won: number;
    Lost: number;
    monthlyData: {
      new: number[];
      prospect: number[];
      proposal: number[];
      won: number[];
      lost: number[];
      revenue: number[];
    };
  };
  dealsByOwner: Array<{ name: string; deals: number; value: number }>;
  dealsBySource: Array<{ name: string; count: number; value: number }>;
  topDeals: Array<{ name: string; value: number; owner: string; stage: string }>;
  recentDeals: Array<{ name: string; value: number; owner: string; stage: string; closedDate: string }>;
  dealsByCountry: Array<{ name: string; deals: number; value: number }>;
  wonDealsStage: Array<{ stage: string; percentage: number; value: number }>;
  recentActivities: Array<{ type: string; description: string; time: string; user: string }>;
}

interface DateRange {
  start: string;
  end: string;
}

const DealsDashboard = () => {
  const routes = all_routes;
  const socket = useSocket();
  const { user } = useUser();
  const [dashboardData, setDashboardData] = useState<DealData | null>(null);
  const [dataReceived, setDataReceived] = useState(false);
  const [requestTimedOut, setRequestTimedOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<"week" | "month" | "year">("week");
  
  // Date range state
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(new Date().getFullYear(), 0, 1).toISOString(), // Start of current year
    end: new Date().toISOString(),
  });

  // Filter states for different sections
  const [pipelineFilter, setPipelineFilter] = useState<"thisWeek" | "thisMonth" | "lastWeek">("thisWeek");
  const [dealsStageFilter, setDealsStageFilter] = useState<"thisWeek" | "thisMonth" | "lastWeek">("thisWeek");
  const [companiesFilter, setCompaniesFilter] = useState<"thisWeek" | "thisMonth" | "lastWeek">("thisWeek");
  const [topDealsFilter, setTopDealsFilter] = useState<"thisWeek" | "thisMonth" | "lastWeek">("thisWeek");
  const [countryFilter, setCountryFilter] = useState<"thisMonth" | "thisWeek" | "lastWeek">("thisMonth");
  const [wonDealsFilter, setWonDealsFilter] = useState<"salesPipeline" | "marketingPipeline">("salesPipeline");
  const [selectedPipelineYear, setSelectedPipelineYear] = useState<number>(new Date().getFullYear());

  // Enhanced pipeline chart configuration
  const [pipeline_chart, setPipelineChart] = useState<any>({
    series: [
      {
        name: "Deal Value",
        data: [0, 0, 0, 0, 0],
      },
    ],
    chart: {
      type: "bar",
      height: 280,
      toolbar: {
        show: false,
      },
    },
    plotOptions: {
      bar: {
        borderRadius: 4,
        horizontal: true,
        distributed: true,
        barHeight: "70%",
        isFunnel: true,
      },
    },
    colors: ["#28a745", "#17a2b8", "#ffc107", "#fd7e14", "#dc3545"],
    dataLabels: {
      enabled: true,
      formatter: function (val: any, opt: any) {
        const categories = ["New", "Prospect", "Proposal", "Won", "Lost"];
        return categories[opt.dataPointIndex] + ": $" + val.toLocaleString();
      },
      style: {
        fontSize: "12px",
        fontWeight: "bold",
        colors: ["#fff"]
      },
      dropShadow: {
        enabled: true,
      },
    },
    xaxis: {
      categories: ["New", "Prospect", "Proposal", "Won", "Lost"],
      labels: {
        formatter: function (val: any) {
          return "$" + val.toLocaleString();
        },
      },
    },
    yaxis: {
      labels: {
        show: false,
      },
    },
    legend: {
      show: false,
    },
    tooltip: {
      y: {
        formatter: function (val: number) {
          return "$" + val.toLocaleString();
        },
      },
    },
  });

  // Enhanced deals stage chart
  const [deals_stage, setDealsStage] = useState<any>({
    chart: {
      height: 310,
      type: "bar",
      stacked: false,
      toolbar: {
        show: false,
      },
    },
    colors: ["#FF6F28", "#28a745"],
    responsive: [
      {
        breakpoint: 480,
        options: {
          legend: {
            position: "bottom",
            offsetX: -10,
            offsetY: 0,
          },
        },
      },
    ],
    plotOptions: {
      bar: {
        borderRadius: 5,
        horizontal: false,
        endingShape: "rounded",
        columnWidth: "60%",
      },
    },
    series: [
      {
        name: "Deal Count",
        data: [0, 0, 0, 0],
      },
      {
        name: "Deal Value ($K)",
        data: [0, 0, 0, 0],
      },
    ],
    xaxis: {
      categories: ["New", "Prospect", "Proposal", "Won"],
      labels: {
        style: {
          colors: "#6B7280",
          fontSize: "13px",
        },
      },
    },
    yaxis: {
      labels: {
        offsetX: -15,
        style: {
          colors: "#6B7280",
          fontSize: "13px",
        },
        formatter: function (val: number) {
          return val.toLocaleString();
        },
      },
    },
    grid: {
      borderColor: "#E5E7EB",
      strokeDashArray: 5,
    },
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "right",
    },
    dataLabels: {
      enabled: false,
    },
    fill: {
      opacity: 1,
    },
    tooltip: {
      y: {
        formatter: function (val: number, opts: any) {
          if (opts.seriesIndex === 1) {
            return "$" + (val * 1000).toLocaleString();
          }
          return val.toString();
        },
      },
    },
  });

  // Radar chart for top deals analysis
  const [radarChartData, setRadarChartData] = useState({});
  const [radarChartOptions, setRadarChartOptions] = useState({});
  
  useEffect(() => {
    const data = {
      labels: ["New Deals", "Prospects", "Proposals", "Won Deals", "Revenue", "Conversion"], 
      datasets: [
        {
          label: "Current Period",
          data: [40, 70, 60, 80, 90, 65],
          backgroundColor: "rgba(40, 167, 69, 0.2)",
          borderColor: "#28a745",
          pointBackgroundColor: "#28a745",
          pointBorderColor: "#fff",
          pointHoverBackgroundColor: "#fff",
          pointHoverBorderColor: "#28a745",
          tension: 0.3,
        },
        {
          label: "Previous Period",
          data: [30, 50, 40, 60, 70, 50],
          backgroundColor: "rgba(255, 111, 40, 0.2)",
          borderColor: "#FF6F28",
          pointBackgroundColor: "#FF6F28",
          pointBorderColor: "#fff",
          pointHoverBackgroundColor: "#fff",
          pointHoverBorderColor: "#FF6F28",
          tension: 0.4,
        },
      ],
    };
    
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          angleLines: {
            display: true,
            color: "#e9e9e9",
          },
          grid: {
            circular: true,
            color: "#e9e9e9",
          },
          suggestedMin: 0,
          suggestedMax: 100,
          ticks: {
            stepSize: 20,
            display: false,
          },
          pointLabels: {
            font: {
              size: 12,
            },
          },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: "bottom" as const,
        },
      },
    };

    setRadarChartData(data);
    setRadarChartOptions(options);
  }, []);

  // Socket integration for real-time data
  useEffect(() => {
    if (!socket) {
      console.log("[DealsDashboard] Socket not available yet");
      return;
    }

    console.log("[DealsDashboard] Socket available, setting up listeners");

    const handleDashboardResponse = (response: any) => {
      console.log("[DealsDashboard] Received response:", response);
      setRequestTimedOut(false);

      if (response.done) {
        const data = response.data || {};
        console.log("[DealsDashboard] Dashboard data:", data);

        setDashboardData(data);
        setDataReceived(true);
        setErrorMessage(null);

        // Update charts with real data
        if (data.dealsByStage) {
          updatePipelineChart(data.dealsByStage);
          updateDealsStageChart(data.dealsByStage);
        }
        
        if (data.topDeals) {
          updateRadarChart(data.topDeals);
        }

        console.log("[DealsDashboard] Dashboard data set successfully");
      } else {
        console.error("Deals dashboard error:", response.error);
        setErrorMessage(response.error || "Failed to load dashboard");
        setDataReceived(true);
        // Set empty data structure
        setDashboardData({
          totalDeals: 0,
          totalDealValue: 0,
          wonDeals: 0,
          lostDeals: 0,
          averageDealSize: 0,
          conversionRate: 0,
          revenueThisMonth: 0,
          activeDeals: 0,
          dealsByStage: {
            New: 0,
            Prospect: 0,
            Proposal: 0,
            Won: 0,
            Lost: 0,
            monthlyData: {
              new: new Array(12).fill(0),
              prospect: new Array(12).fill(0),
              proposal: new Array(12).fill(0),
              won: new Array(12).fill(0),
              lost: new Array(12).fill(0),
              revenue: new Array(12).fill(0),
            },
          },
          dealsByOwner: [],
          dealsBySource: [],
          topDeals: [],
          recentDeals: [],
          dealsByCountry: [],
          wonDealsStage: [],
          recentActivities: [],
        });
      }
    };

    // Listen for dashboard response
    (socket as any).on("deal/dashboard/get-all-data-response", handleDashboardResponse);

    // Fetch data if socket is connected
    if ((socket as any).connected) {
      setRequestTimedOut(false);
      const timer = setTimeout(() => {
        console.warn("[DealsDashboard] Request timed out");
        setRequestTimedOut(true);
        setDataReceived(true);
        setErrorMessage("No response from server. Please try again.");
      }, 7000);

      (socket as any).emit("deal/dashboard/get-all-data", {
        filter,
        dateRange,
        pipelineFilter,
        dealsStageFilter,
        companiesFilter,
        topDealsFilter,
        countryFilter,
        wonDealsFilter,
        selectedPipelineYear,
      });

      (socket as any).once("deal/dashboard/get-all-data-response", () => clearTimeout(timer));
    } else {
      const onConnect = () => {
        (socket as any).emit("deal/dashboard/get-all-data", {
          filter,
          dateRange,
          pipelineFilter,
          dealsStageFilter,
          companiesFilter,
          topDealsFilter,
          countryFilter,
          wonDealsFilter,
          selectedPipelineYear,
        });
      };
      (socket as any).on("connect", onConnect);

      return () => {
        (socket as any).off("connect", onConnect);
        (socket as any).off("deal/dashboard/get-all-data-response", handleDashboardResponse);
      };
    }

    return () => {
      (socket as any).off("deal/dashboard/get-all-data-response", handleDashboardResponse);
    };
  }, [socket, filter, dateRange, pipelineFilter, dealsStageFilter, companiesFilter, topDealsFilter, countryFilter, wonDealsFilter, selectedPipelineYear]);

  // Chart update functions
  const updatePipelineChart = (dealsByStage: any) => {
    const stageData = [
      dealsByStage.New || 0,
      dealsByStage.Prospect || 0,
      dealsByStage.Proposal || 0,
      dealsByStage.Won || 0,
      dealsByStage.Lost || 0,
    ];

    setPipelineChart(prev => ({
      ...prev,
      series: [{ ...prev.series[0], data: stageData }]
    }));
  };

  const updateDealsStageChart = (dealsByStage: any) => {
    const countData = [
      dealsByStage.New || 0,
      dealsByStage.Prospect || 0,
      dealsByStage.Proposal || 0,
      dealsByStage.Won || 0,
    ];

    const valueData = dealsByStage.monthlyData ? [
      dealsByStage.monthlyData.new?.reduce((a: number, b: number) => a + b, 0) / 1000 || 0,
      dealsByStage.monthlyData.prospect?.reduce((a: number, b: number) => a + b, 0) / 1000 || 0,
      dealsByStage.monthlyData.proposal?.reduce((a: number, b: number) => a + b, 0) / 1000 || 0,
      dealsByStage.monthlyData.won?.reduce((a: number, b: number) => a + b, 0) / 1000 || 0,
    ] : [0, 0, 0, 0];

    setDealsStage(prev => ({
      ...prev,
      series: [
        { name: "Deal Count", data: countData },
        { name: "Deal Value ($K)", data: valueData }
      ]
    }));
  };

  const updateRadarChart = (topDeals: any[]) => {
    if (!topDeals || topDeals.length === 0) return;
    
    // Calculate metrics based on top deals
    const metrics = topDeals.slice(0, 6).map(deal => deal.value / 1000);
    
    setRadarChartData((prev: any) => ({
      ...prev,
      datasets: [
        {
          ...prev.datasets[0],
          data: metrics.length >= 6 ? metrics : [...metrics, ...new Array(6 - metrics.length).fill(0)]
        },
        prev.datasets[1] // Keep previous period data
      ]
    }));
  };

  // Export functionality
  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    let yPosition = 20;

    // Title
    doc.setFontSize(20);
    doc.text("Deals Dashboard Report", 20, yPosition);
    yPosition += 20;

    // Date range
    doc.setFontSize(12);
    doc.text(`Report generated: ${new Date().toLocaleDateString()}`, 20, yPosition);
    yPosition += 10;
    doc.text(`Date range: ${new Date(dateRange.start).toLocaleDateString()} - ${new Date(dateRange.end).toLocaleDateString()}`, 20, yPosition);
    yPosition += 20;

    // Key metrics
    if (dashboardData) {
      doc.setFontSize(16);
      doc.text("Key Metrics", 20, yPosition);
      yPosition += 15;

      doc.setFontSize(12);
      const metrics = [
        `Total Deals: ${dashboardData.totalDeals?.toLocaleString() || 0}`,
        `Total Deal Value: $${dashboardData.totalDealValue?.toLocaleString() || 0}`,
        `Won Deals: ${dashboardData.wonDeals?.toLocaleString() || 0}`,
        `Lost Deals: ${dashboardData.lostDeals?.toLocaleString() || 0}`,
        `Average Deal Size: $${dashboardData.averageDealSize?.toLocaleString() || 0}`,
        `Conversion Rate: ${dashboardData.conversionRate?.toFixed(1) || 0}%`,
        `Revenue This Month: $${dashboardData.revenueThisMonth?.toLocaleString() || 0}`,
        `Active Deals: ${dashboardData.activeDeals?.toLocaleString() || 0}`,
      ];

      metrics.forEach((metric) => {
        doc.text(metric, 20, yPosition);
        yPosition += 8;
      });
    }

    doc.save("deals-dashboard-report.pdf");
  };

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      ["Metric", "Value"],
      ["Total Deals", dashboardData?.totalDeals || 0],
      ["Total Deal Value", dashboardData?.totalDealValue || 0],
      ["Won Deals", dashboardData?.wonDeals || 0],
      ["Lost Deals", dashboardData?.lostDeals || 0],
      ["Average Deal Size", dashboardData?.averageDealSize || 0],
      ["Conversion Rate (%)", dashboardData?.conversionRate || 0],
      ["Revenue This Month", dashboardData?.revenueThisMonth || 0],
      ["Active Deals", dashboardData?.activeDeals || 0],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    // Recent deals sheet
    if (dashboardData?.recentDeals && dashboardData.recentDeals.length > 0) {
      const dealsData = [
        ["Deal Name", "Value", "Owner", "Stage", "Closed Date"],
        ...dashboardData.recentDeals.map(deal => [
          deal.name,
          deal.value,
          deal.owner,
          deal.stage,
          deal.closedDate
        ])
      ];
      const dealsSheet = XLSX.utils.aoa_to_sheet(dealsData);
      XLSX.utils.book_append_sheet(workbook, dealsSheet, "Recent Deals");
    }

    XLSX.writeFile(workbook, "deals-dashboard-report.xlsx");
  };

  // Utility functions
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  const getGrowthIcon = (growth: number) => {
    if (growth > 0) {
      return <i className="ti ti-arrow-wave-right-up me-1 text-success" />;
    } else if (growth < 0) {
      return <i className="ti ti-arrow-wave-right-down me-1 text-danger" />;
    } else {
      return <i className="ti ti-minus me-1 text-warning" />;
    }
  };

  const getGrowthColor = (growth: number): string => {
    if (growth > 0) return "text-success";
    if (growth < 0) return "text-danger";
    return "text-warning";
  };

  // Loading state
  if (!dataReceived && !requestTimedOut) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "400px" }}>
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const formattedDate = `${month}-${day}-${year}`;
  const defaultValue = dayjs(formattedDate);

  return (
    <>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          {/* Breadcrumb */}
          <div className="d-md-flex d-block align-items-center justify-content-between page-breadcrumb mb-3">
            <div className="my-auto mb-2">
              <h2 className="mb-1">Deals Dashboard</h2>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>
                      <i className="ti ti-smart-home" />
                    </Link>
                  </li>
                  <li className="breadcrumb-item">Dashboard</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Deals Dashboard
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap ">
              <div className="me-2 mb-2">
                <div className="dropdown">
                  <Link
                    to="#"
                    className="dropdown-toggle btn btn-white d-inline-flex align-items-center"
                    data-bs-toggle="dropdown"
                  >
                    <i className="ti ti-file-export me-1" />
                    Export
                  </Link>
                  <ul className="dropdown-menu  dropdown-menu-end p-3">
                    <li>
                      <Link to="#" className="dropdown-item rounded-1" onClick={exportToPDF}>
                        <i className="ti ti-file-type-pdf me-1" />
                        Export as PDF
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1" onClick={exportToExcel}>
                        <i className="ti ti-file-type-xls me-1" />
                        Export as Excel{" "}
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="input-icon mb-2 position-relative">
                <PredefinedDateRanges />
              </div>
              <div className="ms-2 head-icons">
                <CollapseHeader />
              </div>
            </div>
          </div>
          {/* /Breadcrumb */}
          <div className="row">
            <div className="col-xl-6 d-flex">
              <div className="row flex-fill">
                <div className="col-sm-6">
                  <div className="card bg-linear-gradiant border-white border-2 overlay-bg-3 position-relative">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-center flex-wrap mb-3">
                        <div>
                          <p className="fw-medium mb-1">Total Deals</p>
                          <h5>{dashboardData?.totalDeals?.toLocaleString() || 0}</h5>
                        </div>
                        <div className="avatar avatar-md br-10 icon-rotate bg-primary">
                          <span className="d-flex align-items-center">
                            <i className="ti ti-briefcase text-white fs-16" />
                          </span>
                        </div>
                      </div>
                      <div className="progress progress-xs mb-2">
                        <div
                          className="progress-bar bg-primary"
                          role="progressbar"
                          style={{ width: `${Math.min(100, (dashboardData?.totalDeals || 0) / 10)}%` }}
                        />
                      </div>
                      <p className="fw-medium fs-13">
                        <span className={`fs-12 ${getGrowthColor(5.2)}`}>
                          {getGrowthIcon(5.2)}
                          +5.2%{" "}
                        </span>{" "}
                        from last week
                      </p>
                    </div>
                  </div>
                  <div className="card bg-linear-gradiant border-white border-2 overlay-bg-3 position-relative">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-center flex-wrap mb-3">
                        <div>
                          <p className="fw-medium mb-1">Total Deal Value</p>
                          <h5>{formatCurrency(dashboardData?.totalDealValue || 0)}</h5>
                        </div>
                        <div className="avatar avatar-md br-10 icon-rotate bg-secondary">
                          <span className="d-flex align-items-center">
                            <i className="ti ti-currency-dollar text-white fs-16" />
                          </span>
                        </div>
                      </div>
                      <div className="progress progress-xs mb-2">
                        <div
                          className="progress-bar bg-secondary"
                          role="progressbar"
                          style={{ width: "65%" }}
                        />
                      </div>
                      <p className="fw-medium fs-13">
                        <span className={`fs-12 ${getGrowthColor(12.5)}`}>
                          {getGrowthIcon(12.5)}
                          +12.5%{" "}
                        </span>{" "}
                        from last week
                      </p>
                    </div>
                  </div>
                  <div className="card bg-linear-gradiant border-white border-2 overlay-bg-3 position-relative">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-center flex-wrap mb-3">
                        <div>
                          <p className="fw-medium mb-1">Revenue This Month</p>
                          <h5>{formatCurrency(dashboardData?.revenueThisMonth || 0)}</h5>
                        </div>
                        <div className="avatar avatar-md br-10 icon-rotate bg-pink">
                          <span className="d-flex align-items-center">
                            <i className="ti ti-trending-up text-white fs-16" />
                          </span>
                        </div>
                      </div>
                      <div className="progress progress-xs mb-2">
                        <div
                          className="progress-bar bg-pink"
                          role="progressbar"
                          style={{ width: "78%" }}
                        />
                      </div>
                      <p className="fw-medium fs-13">
                        <span className={`fs-12 ${getGrowthColor(18.3)}`}>
                          {getGrowthIcon(18.3)}
                          +18.3%{" "}
                        </span>{" "}
                        from last week
                      </p>
                    </div>
                  </div>
                </div>
                <div className="col-sm-6">
                  <div className="card bg-linear-gradiant border-white border-2 overlay-bg-3 position-relative">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-center flex-wrap mb-3">
                        <div>
                          <p className="fw-medium mb-1">Won Deals</p>
                          <h5>{dashboardData?.wonDeals?.toLocaleString() || 0}</h5>
                        </div>
                        <div className="avatar avatar-md br-10 icon-rotate bg-success">
                          <span className="d-flex align-items-center">
                            <i className="ti ti-trophy text-white fs-16" />
                          </span>
                        </div>
                      </div>
                      <div className="progress progress-xs mb-2">
                        <div
                          className="progress-bar bg-success"
                          role="progressbar"
                          style={{ width: "85%" }}
                        />
                      </div>
                      <p className="fw-medium fs-13">
                        <span className={`fs-12 ${getGrowthColor(24.1)}`}>
                          {getGrowthIcon(24.1)}
                          +24.1%{" "}
                        </span>{" "}
                        from last week
                      </p>
                    </div>
                  </div>
                  <div className="card bg-linear-gradiant border-white border-2 overlay-bg-3 position-relative">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-center flex-wrap mb-3">
                        <div>
                          <p className="fw-medium mb-1">Conversion Rate</p>
                          <h5>{formatPercentage(dashboardData?.conversionRate || 0)}</h5>
                        </div>
                        <div className="avatar avatar-md br-10 icon-rotate bg-info">
                          <span className="d-flex align-items-center">
                            <i className="ti ti-percentage text-white fs-16" />
                          </span>
                        </div>
                      </div>
                      <div className="progress progress-xs mb-2">
                        <div
                          className="progress-bar bg-info"
                          role="progressbar"
                          style={{ width: `${Math.min(100, dashboardData?.conversionRate || 0)}%` }}
                        />
                      </div>
                      <p className="fw-medium fs-13">
                        <span className={`fs-12 ${getGrowthColor(-2.1)}`}>
                          {getGrowthIcon(-2.1)}
                          -2.1%{" "}
                        </span>{" "}
                        from last week
                      </p>
                    </div>
                  </div>
                  <div className="card bg-linear-gradiant border-white border-2 overlay-bg-3 position-relative">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-center flex-wrap mb-3">
                        <div>
                          <p className="fw-medium mb-1">Average Deal Size</p>
                          <h5>{formatCurrency(dashboardData?.averageDealSize || 0)}</h5>
                        </div>
                        <div className="avatar avatar-md br-10 icon-rotate bg-warning">
                          <span className="d-flex align-items-center">
                            <i className="ti ti-calculator text-white fs-16" />
                          </span>
                        </div>
                      </div>
                      <div className="progress progress-xs mb-2">
                        <div
                          className="progress-bar bg-warning"
                          role="progressbar"
                          style={{ width: "72%" }}
                        />
                      </div>
                      <p className="fw-medium fs-13">
                        <span className={`fs-12 ${getGrowthColor(8.7)}`}>
                          {getGrowthIcon(8.7)}
                          +8.7%{" "}
                        </span>{" "}
                        from last week
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-xl-6 d-flex">
              <div className="card flex-fill">
                <div className="card-header">
                  <div className="d-flex align-items-center justify-content-between">
                    <h5>Pipeline Stages</h5>
                    <div className="dropdown">
                      <Link
                        to="#"
                        className="btn btn-white border btn-sm d-inline-flex align-items-center"
                        data-bs-toggle="dropdown"
                      >
                        <i className="ti ti-calendar me-1" />
                        This Week
                      </Link>
                      <ul className="dropdown-menu  dropdown-menu-end p-3">
                        <li>
                          <Link to="#" className="dropdown-item rounded-1">
                            This Month
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item rounded-1">
                            This Week
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item rounded-1">
                            Last Week
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <ReactApexChart
                    id="pipeline_chart"
                    options={pipeline_chart}
                    series={pipeline_chart.series}
                    type="bar"
                    height={280}
                  />
                  <div>
                    <h6 className="mb-3">Deal Values By Stages</h6>
                    <div className="row g-2 justify-content-center">
                      <div className="col-md col-sm-4 col-6">
                        <div className="border rounded text-center p-2">
                          <p className="mb-1">
                            <i className="ti ti-point-filled text-success" />
                            New
                          </p>
                          <h6>{formatCurrency(dashboardData?.dealsByStage?.New || 0)}</h6>
                        </div>
                      </div>
                      <div className="col-md col-sm-4 col-6">
                        <div className="border rounded text-center p-2">
                          <p className="mb-1">
                            <i className="ti ti-point-filled text-info" />
                            Prospect
                          </p>
                          <h6>{formatCurrency(dashboardData?.dealsByStage?.Prospect || 0)}</h6>
                        </div>
                      </div>
                      <div className="col-md col-sm-4 col-6">
                        <div className="border rounded text-center p-2">
                          <p className="mb-1">
                            <i className="ti ti-point-filled text-warning" />
                            Proposal
                          </p>
                          <h6>{formatCurrency(dashboardData?.dealsByStage?.Proposal || 0)}</h6>
                        </div>
                      </div>
                      <div className="col-md col-sm-4 col-6">
                        <div className="border rounded text-center p-2">
                          <p className="mb-1">
                            <i className="ti ti-point-filled text-primary" />
                            Won
                          </p>
                          <h6>{formatCurrency(dashboardData?.dealsByStage?.Won || 0)}</h6>
                        </div>
                      </div>
                      <div className="col-md col-sm-4 col-6">
                        <div className="border rounded text-center p-2">
                          <p className="mb-1">
                            <i className="ti ti-point-filled text-danger" />
                            Lost
                          </p>
                          <h6>{formatCurrency(dashboardData?.dealsByStage?.Lost || 0)}</h6>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-xl-4 d-flex">
              <div className="card flex-fill">
                <div className="card-header">
                  <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-2">
                    <h5>Deals by Stage</h5>
                    <div className="dropdown">
                      <Link
                        to="#"
                        className="btn btn-white border btn-sm d-inline-flex align-items-center"
                        data-bs-toggle="dropdown"
                      >
                        <i className="ti ti-calendar me-1" />
                        This Week
                      </Link>
                      <ul className="dropdown-menu  dropdown-menu-end p-3">
                        <li>
                          <Link to="#" className="dropdown-item rounded-1">
                            This Month
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item rounded-1">
                            This Week
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item rounded-1">
                            Last Week
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="card-body pb-0">
                  <div>
                    <div className="d-flex align-items-center">
                      <h3 className="me-2">{formatPercentage(dashboardData?.conversionRate || 0)}</h3>
                      <span className="badge badge-outline-success bg-success-transparent rounded-pill me-1">
                        +8.2%
                      </span>
                      <span>vs last period</span>
                    </div>
                    <ReactApexChart
                      id="deals-stage-chart"
                      options={deals_stage}
                      series={deals_stage.series}
                      type="bar"
                      height={310}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="col-xl-4 d-flex">
              <div className="card flex-fill">
                <div className="card-header">
                  <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-2">
                    <h5>Deals By Companies</h5>
                    <div className="dropdown">
                      <Link
                        to="#"
                        className="btn btn-white border btn-sm d-inline-flex align-items-center"
                        data-bs-toggle="dropdown"
                      >
                        <i className="ti ti-calendar me-1" />
                        This Week
                      </Link>
                      <ul className="dropdown-menu  dropdown-menu-end p-3">
                        <li>
                          <Link to="#" className="dropdown-item rounded-1">
                            This Month
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item rounded-1">
                            This Week
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item rounded-1">
                            Last Week
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <div>
                    {dashboardData?.dealsByOwner && dashboardData.dealsByOwner.length > 0 ? (
                      dashboardData.dealsByOwner.slice(0, 5).map((owner, index) => (
                        <div key={index} className="border border-dashed bg-transparent-light rounded p-2 mb-2">
                          <div className="d-flex align-items-center justify-content-between">
                            <div className="d-flex align-items-center">
                              <Link
                                to="#"
                                className="avatar avatar-md rounded-circle bg-gray-100 flex-shrink-0 me-2"
                              >
                                <span className="text-primary fw-bold">
                                  {owner.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                </span>
                              </Link>
                              <div>
                                <h6 className="fw-medium mb-1">{owner.name}</h6>
                                <p className="text-truncate">
                                  {owner.deals} deals • Avg: {formatCurrency(owner.value / owner.deals)}
                                </p>
                              </div>
                            </div>
                            <div>
                              <h6>{formatCurrency(owner.value)}</h6>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4">
                        <i className="ti ti-briefcase fs-48 text-muted mb-3"></i>
                        <p className="text-muted">No deal owners data available</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="col-xl-4 d-flex">
              <div className="card flex-fill">
                <div className="card-header">
                  <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-2">
                    <h5>Top Deals</h5>
                    <div className="dropdown">
                      <Link
                        to="#"
                        className="btn btn-white border btn-sm d-inline-flex align-items-center"
                        data-bs-toggle="dropdown"
                      >
                        <i className="ti ti-calendar me-1" />
                        This Week
                      </Link>
                      <ul className="dropdown-menu  dropdown-menu-end p-3">
                        <li>
                          <Link to="#" className="dropdown-item rounded-1">
                            This Month
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item rounded-1">
                            This Week
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item rounded-1">
                            Last Week
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <div className="text-center mb-4">
                    <Chart
                      type="radar"
                      data={radarChartData}
                      options={radarChartOptions}
                      className="mx-auto mb-3"
                      style={{ height: "300px" }}
                    />
                  </div>
                  <div>
                    <h6 className="mb-3">Deal Performance Metrics</h6>
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <p className="f-13 mb-0">
                        <i className="ti ti-circle-filled text-success me-1" />
                        New Deals
                      </p>
                      <p className="f-13 fw-medium text-gray-9">{dashboardData?.dealsByStage?.New || 0}</p>
                    </div>
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <p className="f-13 mb-0">
                        <i className="ti ti-circle-filled text-warning me-1" />
                        Proposals
                      </p>
                      <p className="f-13 fw-medium text-gray-9">{dashboardData?.dealsByStage?.Proposal || 0}</p>
                    </div>
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <p className="f-13 mb-0">
                        <i className="ti ti-circle-filled text-primary me-1" />
                        Won Deals
                      </p>
                      <p className="f-13 fw-medium text-gray-9">{dashboardData?.dealsByStage?.Won || 0}</p>
                    </div>
                    <div className="d-flex align-items-center justify-content-between">
                      <p className="f-13 mb-0">
                        <i className="ti ti-circle-filled text-info me-1" />
                        Total Revenue
                      </p>
                      <p className="f-13 fw-medium text-gray-9">{formatCurrency(dashboardData?.revenueThisMonth || 0)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-xl-4 d-flex">
              <div className="card flex-fill">
                <div className="card-header">
                  <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-2">
                    <h5>Deals By Country</h5>
                    <div>
                      <Link
                        to="countries.html"
                        className="btn btn-light btn-sm px-3"
                      >
                        View All
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="card-body py-2">
                  {dashboardData?.dealsByCountry && dashboardData.dealsByCountry.length > 0 ? (
                    <div className="table-responsive pt-1">
                      <table className="table table-nowrap table-borderless mb-0">
                        <tbody>
                          {dashboardData.dealsByCountry.slice(0, 5).map((country, index) => (
                            <tr key={index}>
                              <td className="px-0">
                                <div className="d-flex align-items-center mb-2">
                                  <div className="avatar rounded-circle border border-2 d-flex align-items-center justify-content-center">
                                    <span style={{ fontSize: "20px" }}>
                                      {(() => {
                                        const flagMap: { [key: string]: string } = {
                                          "United States": "🇺🇸", "USA": "🇺🇸", "US": "🇺🇸",
                                          "United Kingdom": "🇬🇧", "UK": "🇬🇧", "Britain": "🇬🇧",
                                          "Germany": "🇩🇪", "France": "🇫🇷", "Italy": "🇮🇹", "Spain": "🇪🇸",
                                          "Canada": "🇨🇦", "Australia": "🇦🇺", "Japan": "🇯🇵", "China": "🇨🇳",
                                          "India": "🇮🇳", "Brazil": "🇧🇷", "Russia": "🇷🇺", "Mexico": "🇲🇽",
                                          "Netherlands": "🇳🇱", "Sweden": "🇸🇪", "Norway": "🇳🇴", "Denmark": "🇩🇰",
                                          "Singapore": "🇸🇬", "UAE": "🇦🇪", "Switzerland": "🇨🇭", "Austria": "🇦🇹"
                                        };
                                        return flagMap[country.name] || flagMap[country.name?.toUpperCase()] || "🌍";
                                      })()}
                                    </span>
                                  </div>
                                  <div className="ms-2">
                                    <h6 className="fw-medium mb-1">
                                      <Link to="#">{country.name}</Link>
                                    </h6>
                                    <span className="fs-13 d-inline-flex align-items-center">
                                      Deals: {country.deals}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div className="text-center mb-2">
                                  <CircleProgress value={Math.min(100, (country.deals / 10) * 100)} />
                                </div>
                              </td>
                              <td className="px-0 text-end">
                                <div className="mb-2">
                                  <p className="fs-13 mb-1">Total Value</p>
                                  <h6 className="fw-medium">{formatCurrency(country.value)}</h6>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <i className="ti ti-world fs-48 text-muted mb-3"></i>
                      <p className="text-muted">No country data available</p>
                    </div>
                  )}
                </div>

              </div>
            </div>
            <div className="col-xl-4 d-flex">
              <div className="card flex-fill">
                <div className="card-header">
                  <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-2">
                    <h5>Won Deals Stage</h5>
                    <div className="dropdown">
                      <Link
                        to="#"
                        className="btn btn-white border-0 dropdown-toggle btn-sm d-inline-flex align-items-center"
                        data-bs-toggle="dropdown"
                      >
                        Sales Pipeline
                      </Link>
                      <ul className="dropdown-menu  dropdown-menu-end p-3">
                        <li>
                          <Link to="#" className="dropdown-item rounded-1">
                            This Month
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item rounded-1">
                            This Week
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item rounded-1">
                            Last Week
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <div className="text-center mb-4">
                    <p className="mb-1 fw-medium">Stages Won This Year</p>
                    <div className="d-flex align-items-center justify-content-center">
                      <h3 className="me-2">$45,899,79</h3>
                      <span className="badge badge-soft-danger border-danger border rounded-pill me-1">
                        $45,899,79
                      </span>
                    </div>
                  </div>
                  <div className="stage-chart-main">
                    <div className="deal-stage-chart">
                      <div className="text-center d-flex align-items-center justify-content-center flex-column bg-secondary rounded-circle chart-stage-1">
                        <span className="d-block text-white mb-1">
                          Conversion
                        </span>
                        <h6 className="text-white">48%</h6>
                      </div>
                      <div className="text-center d-flex align-items-center justify-content-center flex-column bg-danger rounded-circle chart-stage-2">
                        <span className="d-block text-white mb-1">Calls</span>
                        <h6 className="text-white">24%</h6>
                      </div>
                      <div className="text-center d-flex align-items-center justify-content-center flex-column bg-warning rounded-circle chart-stage-3">
                        <span className="d-block text-white mb-1">Email</span>
                        <h6 className="text-white">39%</h6>
                      </div>
                      <div className="text-center d-flex align-items-center justify-content-center flex-column bg-success rounded-circle chart-stage-4">
                        <span className="d-block text-white mb-1">Chats</span>
                        <h6 className="text-white">20%</h6>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-xl-4 d-flex">
              <div className="card flex-fill">
                <div className="card-header">
                  <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-2">
                    <h5>Recent Follow Up</h5>
                    <div>
                      <Link to="#" className="btn btn-light btn-sm px-3">
                        View All
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="card-body">
                  <div className="d-flex align-items-center justify-content-between mb-4">
                    <div className="d-flex align-items-center">
                      <Link to="#" className="avatar flex-shrink-0">
                        <ImageWithBasePath
                          src="assets/img/users/user-27.jpg"
                          className="rounded-circle border border-2"
                          alt="img"
                        />
                      </Link>
                      <div className="ms-2">
                        <h6 className="fs-14 fw-medium text-truncate mb-1">
                          <Link to="#">Alexander Jermai</Link>
                        </h6>
                        <p className="fs-13">UI/UX Designer</p>
                      </div>
                    </div>
                    <div className="d-flex align-items-center">
                      <Link to="#" className="btn btn-light btn-icon btn-sm">
                        <i className="ti ti-mail-bolt fs-16" />
                      </Link>
                    </div>
                  </div>
                  <div className="d-flex align-items-center justify-content-between mb-4">
                    <div className="d-flex align-items-center">
                      <Link to="#" className="avatar flex-shrink-0">
                        <ImageWithBasePath
                          src="assets/img/users/user-42.jpg"
                          className="rounded-circle border border-2"
                          alt="img"
                        />
                      </Link>
                      <div className="ms-2">
                        <h6 className="fs-14 fw-medium text-truncate mb-1">
                          <Link to="#">Doglas Martini</Link>
                        </h6>
                        <p className="fs-13">Product Designer</p>
                      </div>
                    </div>
                    <div className="d-flex align-items-center">
                      <Link to="#" className="btn btn-light btn-icon btn-sm">
                        <i className="ti ti-phone fs-16" />
                      </Link>
                    </div>
                  </div>
                  <div className="d-flex align-items-center justify-content-between mb-4">
                    <div className="d-flex align-items-center">
                      <Link to="#" className="avatar flex-shrink-0">
                        <ImageWithBasePath
                          src="assets/img/users/user-43.jpg"
                          className="rounded-circle border border-2"
                          alt="img"
                        />
                      </Link>
                      <div className="ms-2">
                        <h6 className="fs-14 fw-medium text-truncate mb-1">
                          <Link to="#">Daniel Esbella</Link>
                        </h6>
                        <p className="fs-13">Project Manager</p>
                      </div>
                    </div>
                    <div className="d-flex align-items-center">
                      <Link to="#" className="btn btn-light btn-icon btn-sm">
                        <i className="ti ti-mail-bolt fs-16" />
                      </Link>
                    </div>
                  </div>
                  <div className="d-flex align-items-center justify-content-between mb-4">
                    <div className="d-flex align-items-center">
                      <Link to="#" className="avatar flex-shrink-0">
                        <ImageWithBasePath
                          src="assets/img/users/user-11.jpg"
                          className="rounded-circle border border-2"
                          alt="img"
                        />
                      </Link>
                      <div className="ms-2">
                        <h6 className="fs-14 fw-medium text-truncate mb-1">
                          <Link to="#">Daniel Esbella</Link>
                        </h6>
                        <p className="fs-13">Team Lead</p>
                      </div>
                    </div>
                    <div className="d-flex align-items-center">
                      <Link to="#" className="btn btn-light btn-icon btn-sm">
                        <i className="ti ti-brand-hipchat fs-16" />
                      </Link>
                    </div>
                  </div>
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center">
                      <Link to="#" className="avatar flex-shrink-0">
                        <ImageWithBasePath
                          src="assets/img/users/user-44.jpg"
                          className="rounded-circle border border-2"
                          alt="img"
                        />
                      </Link>
                      <div className="ms-2">
                        <h6 className="fs-14 fw-medium text-truncate mb-1">
                          <Link to="#">Stephan Peralt</Link>
                        </h6>
                        <p className="fs-13">Team Lead</p>
                      </div>
                    </div>
                    <div className="d-flex align-items-center">
                      <Link to="#" className="btn btn-light btn-icon btn-sm">
                        <i className="ti ti-brand-hipchat fs-16" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-xl-8 d-flex">
              <div className="card flex-fill">
                <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-2">
                  <h5>Recent Deals</h5>
                  <div className="d-flex align-items-center">
                    <div>
                      <Link
                        to="deals.html"
                        className="btn btn-sm btn-light px-3"
                      >
                        View All
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-nowrap dashboard-table mb-0">
                      <thead>
                        <tr>
                          <th>Deal Name</th>
                          <th>Stage</th>
                          <th>Deal Value</th>
                          <th>Owner</th>
                          <th>Closed Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboardData?.recentDeals && dashboardData.recentDeals.length > 0 ? (
                          dashboardData.recentDeals.slice(0, 5).map((deal, index) => (
                            <tr key={index}>
                              <td>
                                <h6 className="fw-medium">
                                  <Link to={`${routes.dealsDetails}/${deal.name}`}>{deal.name}</Link>
                                </h6>
                              </td>
                              <td>
                                <span className={`badge badge-soft-${
                                  deal.stage === 'Won' ? 'success' :
                                  deal.stage === 'Lost' ? 'danger' :
                                  deal.stage === 'Proposal' ? 'warning' :
                                  deal.stage === 'Prospect' ? 'info' : 'primary'
                                }`}>
                                  {deal.stage}
                                </span>
                              </td>
                              <td>{formatCurrency(deal.value)}</td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="avatar avatar-rounded bg-primary-transparent flex-shrink-0 me-2">
                                    <span className="text-primary fw-bold">
                                      {deal.owner.split(' ').map(n => n[0]).join('').toUpperCase()}
                                    </span>
                                  </div>
                                  <h6 className="fw-medium">
                                    <Link to="#">{deal.owner}</Link>
                                  </h6>
                                </div>
                              </td>
                              <td>{new Date(deal.closedDate).toLocaleDateString()}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="text-center py-4">
                              <i className="ti ti-briefcase fs-48 text-muted mb-3"></i>
                              <p className="text-muted">No recent deals available</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-xl-4 d-flex">
              <div className="card flex-fill">
                <div className="card-header">
                  <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-2">
                    <h5>Recent Activities</h5>
                    <div>
                      <Link
                        to="activity.html"
                        className="btn btn-sm btn-light px-3"
                      >
                        View All
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="card-body schedule-timeline activity-timeline">
                  {dashboardData?.recentActivities && dashboardData.recentActivities.length > 0 ? (
                    dashboardData.recentActivities.slice(0, 4).map((activity, index) => (
                      <div key={index} className="d-flex align-items-start">
                        <div className={`avatar avatar-md avatar-rounded flex-shrink-0 ${
                          activity.type === 'call' ? 'bg-success' :
                          activity.type === 'email' ? 'bg-info' :
                          activity.type === 'meeting' ? 'bg-purple' :
                          activity.type === 'deal' ? 'bg-warning' : 'bg-primary'
                        }`}>
                          <i className={`fs-16 ${
                            activity.type === 'call' ? 'ti ti-phone-filled' :
                            activity.type === 'email' ? 'ti ti-mail-filled' :
                            activity.type === 'meeting' ? 'ti ti-users' :
                            activity.type === 'deal' ? 'ti ti-briefcase' : 'ti ti-activity'
                          }`} />
                        </div>
                        <div className={`flex-fill ps-3 ${index < dashboardData.recentActivities.length - 1 ? 'pb-4 timeline-flow' : 'timeline-flow'}`}>
                          <p className="fw-medium text-gray-9 mb-1">
                            <Link to={routes.activity}>
                              {activity.description}
                            </Link>
                          </p>
                          <span className="text-muted fs-12">{activity.time}</span>
                          {activity.user && (
                            <div className="mt-1">
                              <span className="badge badge-soft-primary">{activity.user}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4">
                      <i className="ti ti-activity fs-48 text-muted mb-3"></i>
                      <p className="text-muted">No recent activities</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="footer d-sm-flex align-items-center justify-content-between border-top bg-white p-3">
          <p className="mb-0">2014 - 2025 © Amasqis.</p>
          <p>
            Designed &amp; Developed By{" "}
            <Link to="https://amasqis.ai" className="text-primary">
              Amasqis
            </Link>
          </p>
        </div>
      </div>
      {/* /Page Wrapper */}
    </>
  );
};

export default DealsDashboard;
