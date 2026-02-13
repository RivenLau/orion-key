package com.orionkey.service;

import java.util.List;
import java.util.Map;

public interface DashboardService {

    Map<String, Object> getStats();

    List<?> getSalesTrend(String period, String startDate, String endDate);
}
