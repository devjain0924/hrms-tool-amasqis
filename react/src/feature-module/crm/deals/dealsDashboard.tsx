import React, { useState } from "react";
import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import CollapseHeader from "../../../core/common/collapse-header/collapse-header";
import PredefinedDateRanges from "../../../core/common/datePicker";
import ReactApexChart from "react-apexcharts";
import { useDealDashboard } from "../../../hooks/useDealDashboard";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";

const DealsDashboard = () => {
  const routes = all_routes;
  const { dashboardData, loading, fetchDashboardData } = useDealDashboard();
  const [selectedFilter, setSelectedFilter] = useState<'week' | 'month' | 'year'>('month');

  // Handle filter changes
  const handleFilterChange = (filter: 'week' | 'month' | 'year') => {
    setSelectedFilter(filter);
    fetchDashboardData({ filter });
  };

  // Chart configurations
  const dealsByStageChart = {
    series: dashboardData?.dealsByStage.map(stage => stage.count) || [],
    chart: {
      type: "donut" as const,
      height: 300,
    },
    labels: dashboardData?.dealsByStage.map(stage => stage._id) || [],
    colors: ["#FF6F28", "#28A745", "#FFC107", "#DC3545", "#6C757D"],
    plotOptions: {
      pie: {
        donut: {
          size: "60%",
          labels: {
            show: true,
            total: {
              show: true,
              label: "Total Deals",
              formatter: function () {
                return dashboardData?.totalDealsInPeriod?.toString() || "0";
              },
            },
          },
        },
      },
    },
    legend: {
      show: false,
    },
    dataLabels: {
      enabled: false,
    },
  };

  const monthlyTrendsChart = {
    series: [
      {
        name: "Won Deals",
        data: dashboardData?.monthlyData.won || [],
      },
      {
        name: "Lost Deals",
        data: dashboardData?.monthlyData.lost || [],
      },
      {
        name: "Open Deals",
        data: dashboardData?.monthlyData.open || [],
      },
    ],
    chart: {
      height: 350,
      type: "line" as const,
      toolbar: {
        show: false,
      },
    },
    colors: ["#28A745", "#DC3545", "#FFC107"],
    stroke: {
      width: 3,
      curve: "smooth" as const,
    },
    xaxis: {
      categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      labels: {
        style: {
          colors: "#6B7280",
          fontSize: "13px",
        },
      },
    },
    yaxis: {
      labels: {
        style: {
          colors: "#6B7280",
          fontSize: "13px",
        },
      },
    },
    grid: {
      borderColor: "#E5E7EB",
      strokeDashArray: 5,
    },
    legend: {
      position: "top" as const,
      horizontalAlign: "center" as const,
    },
  };

  const dealValueChart = {
    series: [
      {
        name: "Deal Value",
        data: dashboardData?.monthlyData.wonValue || [],
      },
    ],
    chart: {
      height: 300,
      type: "bar" as const,
      toolbar: {
        show: false,
      },
    },
    colors: ["#FF6F28"],
    plotOptions: {
      bar: {
        borderRadius: 5,
        horizontal: false,
      },
    },
    xaxis: {
      categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      labels: {
        style: {
          colors: "#6B7280",
          fontSize: "13px",
        },
      },
    },
    yaxis: {
      labels: {
        formatter: function (val: number) {
          return "$" + val.toLocaleString();
        },
        style: {
          colors: "#6B7280",
          fontSize: "13px",
        },
      },
    },
    grid: {
      borderColor: "#E5E7EB",
      strokeDashArray: 5,
    },
    dataLabels: {
      enabled: false,
    },
  };

  if (loading && !dashboardData) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex justify-content-center align-items-center" style={{ height: "400px" }}>
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Breadcrumb */}
        <div className="d-md-flex d-block align-items-center justify-content-between page-breadcrumb mb-3">
          <div className="my-auto mb-2">
            <h2 className="mb-1">Deal Dashboard</h2>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <Link to={routes.adminDashboard}>
                    <i className="ti ti-smart-home" />
                  </Link>
                </li>
                <li className="breadcrumb-item">CRM</li>
                <li className="breadcrumb-item active" aria-current="page">
                  Deal Dashboard
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
                <ul className="dropdown-menu dropdown-menu-end p-3">
                  <li>
                    <Link to="#" className="dropdown-item rounded-1">
                      <i className="ti ti-file-type-pdf me-1" />
                      Export as PDF
                    </Link>
                  </li>
                  <li>
                    <Link to="#" className="dropdown-item rounded-1">
                      <i className="ti ti-file-type-xls me-1" />
                      Export as Excel
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
            <div className="me-2 mb-2">
              <div className="input-icon-end position-relative">
                <PredefinedDateRanges />
                <span className="input-icon-addon">
                  <i className="ti ti-chevron-down" />
                </span>
              </div>
            </div>
            <div className="head-icons ms-2">
              <CollapseHeader />
            </div>
          </div>
        </div>
        {/* /Breadcrumb */}

        {/* Summary Cards */}
        <div className="row">
          <div className="col-xl-3 col-sm-6">
            <div className="card">
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center">
                    <span className="avatar avatar-md bg-primary flex-shrink-0 me-2">
                      <i className="ti ti-briefcase fs-16" />
                    </span>
                    <div>
                      <p className="fs-13 fw-medium mb-1">Total Deals</p>
                      <h4>{dashboardData?.totalDealsInPeriod?.toLocaleString() || 0}</h4>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-xl-3 col-sm-6">
            <div className="card">
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center">
                    <span className="avatar avatar-md bg-success flex-shrink-0 me-2">
                      <i className="ti ti-check fs-16" />
                    </span>
                    <div>
                      <p className="fs-13 fw-medium mb-1">Won Deals</p>
                      <h4>{dashboardData?.wonDeals?.toLocaleString() || 0}</h4>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-xl-3 col-sm-6">
            <div className="card">
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center">
                    <span className="avatar avatar-md bg-warning flex-shrink-0 me-2">
                      <i className="ti ti-clock fs-16" />
                    </span>
                    <div>
                      <p className="fs-13 fw-medium mb-1">Open Deals</p>
                      <h4>{dashboardData?.openDeals?.toLocaleString() || 0}</h4>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-xl-3 col-sm-6">
            <div className="card">
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center">
                    <span className="avatar avatar-md bg-info flex-shrink-0 me-2">
                      <i className="ti ti-currency-dollar fs-16" />
                    </span>
                    <div>
                      <p className="fs-13 fw-medium mb-1">Total Value</p>
                      <h4>${dashboardData?.dealValues.totalValue?.toLocaleString() || 0}</h4>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="row">
          <div className="col-xl-4">
            <div className="card">
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center">
                    <span className="avatar avatar-md bg-purple flex-shrink-0 me-2">
                      <i className="ti ti-percentage fs-16" />
                    </span>
                    <div>
                      <p className="fs-13 fw-medium mb-1">Conversion Rate</p>
                      <h4>{dashboardData?.conversionRate?.toFixed(1) || 0}%</h4>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-xl-4">
            <div className="card">
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center">
                    <span className="avatar avatar-md bg-secondary flex-shrink-0 me-2">
                      <i className="ti ti-calendar-stats fs-16" />
                    </span>
                    <div>
                      <p className="fs-13 fw-medium mb-1">Avg Deal Cycle</p>
                      <h4>{dashboardData?.avgDealCycle?.toFixed(0) || 0} days</h4>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-xl-4">
            <div className="card">
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center">
                    <span className="avatar avatar-md bg-danger flex-shrink-0 me-2">
                      <i className="ti ti-trending-down fs-16" />
                    </span>
                    <div>
                      <p className="fs-13 fw-medium mb-1">Lost Deals</p>
                      <h4>{dashboardData?.lostDeals?.toLocaleString() || 0}</h4>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="row">
          <div className="col-xl-8">
            <div className="card">
              <div className="card-header">
                <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-2">
                  <h5>Deal Trends</h5>
                  <div className="dropdown">
                    <Link
                      to="#"
                      className="btn btn-white border btn-sm d-inline-flex align-items-center"
                      data-bs-toggle="dropdown"
                    >
                      <i className="ti ti-calendar me-1" />
                      {selectedFilter === 'week' ? 'This Week' : selectedFilter === 'month' ? 'This Month' : 'This Year'}
                    </Link>
                    <ul className="dropdown-menu dropdown-menu-end p-3">
                      <li>
                        <Link 
                          to="#" 
                          className="dropdown-item rounded-1"
                          onClick={() => handleFilterChange('week')}
                        >
                          This Week
                        </Link>
                      </li>
                      <li>
                        <Link 
                          to="#" 
                          className="dropdown-item rounded-1"
                          onClick={() => handleFilterChange('month')}
                        >
                          This Month
                        </Link>
                      </li>
                      <li>
                        <Link 
                          to="#" 
                          className="dropdown-item rounded-1"
                          onClick={() => handleFilterChange('year')}
                        >
                          This Year
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="card-body">
                <ReactApexChart
                  options={monthlyTrendsChart}
                  series={monthlyTrendsChart.series}
                  type="line"
                  height={350}
                />
              </div>
            </div>
          </div>
          <div className="col-xl-4">
            <div className="card">
              <div className="card-header">
                <h5>Deals by Stage</h5>
              </div>
              <div className="card-body">
                <ReactApexChart
                  options={dealsByStageChart}
                  series={dealsByStageChart.series}
                  type="donut"
                  height={300}
                />
                <div className="mt-3">
                  {dashboardData?.dealsByStage.map((stage, index) => (
                    <div key={stage._id} className="d-flex align-items-center justify-content-between mb-2">
                      <p className="f-13 mb-0">
                        <i className={`ti ti-circle-filled me-1`} style={{color: dealsByStageChart.colors[index]}} />
                        {stage._id}
                      </p>
                      <p className="f-13 fw-medium text-gray-9">{stage.count}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Deal Value Chart */}
        <div className="row">
          <div className="col-xl-12">
            <div className="card">
              <div className="card-header">
                <h5>Monthly Deal Value (Won Deals)</h5>
              </div>
              <div className="card-body">
                <ReactApexChart
                  options={dealValueChart}
                  series={dealValueChart.series}
                  type="bar"
                  height={300}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Data Tables Row */}
        <div className="row">
          <div className="col-xl-6">
            <div className="card">
              <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-2">
                <h5>Top Performing Deals</h5>
                <div>
                  <Link to={routes.dealsList} className="btn btn-sm btn-light px-3">
                    View All
                  </Link>
                </div>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-nowrap mb-0">
                    <thead>
                      <tr>
                        <th>Deal Name</th>
                        <th>Value</th>
                        <th>Owner</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData?.topDeals.slice(0, 5).map((deal) => (
                        <tr key={deal._id}>
                          <td>
                            <h6>
                              <Link to={routes.dealsDetails}>{deal.name}</Link>
                            </h6>
                          </td>
                          <td>${deal.dealValue.toLocaleString()}</td>
                          <td>
                            <div className="d-flex align-items-center">
                              <Link to="#" className="avatar avatar-md avatar-rounded flex-shrink-0 me-2">
                                <ImageWithBasePath src="assets/img/profiles/avatar-20.jpg" alt="Img" />
                              </Link>
                              <h6>
                                <Link to="#">{deal.owner.name}</Link>
                              </h6>
                            </div>
                          </td>
                          <td>
                            <span className={`badge badge-sm ${
                              deal.status === "Won" 
                                ? "badge-success" 
                                : deal.status === "Lost" 
                                ? "badge-danger" 
                                : "badge-info"
                            }`}>
                              {deal.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          <div className="col-xl-6">
            <div className="card">
              <div className="card-header d-flex align-items-center justify-content-between flex-wrap row-gap-2">
                <h5>Recent Deals</h5>
                <div>
                  <Link to={routes.dealsList} className="btn btn-sm btn-light px-3">
                    View All
                  </Link>
                </div>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-nowrap mb-0">
                    <thead>
                      <tr>
                        <th>Deal Name</th>
                        <th>Stage</th>
                        <th>Value</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData?.recentDeals.slice(0, 5).map((deal) => (
                        <tr key={deal._id}>
                          <td>
                            <h6>
                              <Link to={routes.dealsDetails}>{deal.name}</Link>
                            </h6>
                          </td>
                          <td>
                            <span className={`badge badge-sm ${
                              deal.stage === "Won" 
                                ? "badge-success" 
                                : deal.stage === "Lost" 
                                ? "badge-danger" 
                                : deal.stage === "Proposal"
                                ? "badge-warning"
                                : "badge-info"
                            }`}>
                              {deal.stage}
                            </span>
                          </td>
                          <td>${deal.dealValue.toLocaleString()}</td>
                          <td>{new Date(deal.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Deal Owners Performance */}
        <div className="row">
          <div className="col-xl-12">
            <div className="card">
              <div className="card-header">
                <h5>Deal Owners Performance</h5>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-nowrap mb-0">
                    <thead>
                      <tr>
                        <th>Owner</th>
                        <th>Total Deals</th>
                        <th>Won</th>
                        <th>Lost</th>
                        <th>Open</th>
                        <th>Total Value</th>
                        <th>Win Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData?.dealsByOwner.map((owner) => {
                        const winRate = owner.count > 0 ? ((owner.wonCount / owner.count) * 100).toFixed(1) : '0';
                        return (
                          <tr key={owner._id}>
                            <td>
                              <div className="d-flex align-items-center">
                                <Link to="#" className="avatar avatar-md avatar-rounded flex-shrink-0 me-2">
                                  <ImageWithBasePath src="assets/img/profiles/avatar-20.jpg" alt="Img" />
                                </Link>
                                <h6>
                                  <Link to="#">{owner._id || 'Unknown'}</Link>
                                </h6>
                              </div>
                            </td>
                            <td>{owner.count}</td>
                            <td>
                              <span className="badge badge-success badge-sm">{owner.wonCount}</span>
                            </td>
                            <td>
                              <span className="badge badge-danger badge-sm">{owner.lostCount}</span>
                            </td>
                            <td>
                              <span className="badge badge-info badge-sm">{owner.openCount}</span>
                            </td>
                            <td>${owner.value.toLocaleString()}</td>
                            <td>
                              <span className={`badge badge-sm ${
                                parseFloat(winRate) > 50 ? "badge-success" : parseFloat(winRate) > 25 ? "badge-warning" : "badge-danger"
                              }`}>
                                {winRate}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
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
  );
};

export default DealsDashboard;