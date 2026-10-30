<template>
  <div class="weather" v-if="status === 'success'">
    <span>{{ weatherData.adCode.city }}&nbsp;</span>
    <span>{{ weatherData.weather.weather }}&nbsp;</span>
    <span>{{ weatherData.weather.temperature }}℃</span>
    <span class="sm-hidden">
      &nbsp;{{
        weatherData.weather.winddirection?.endsWith("风")
          ? weatherData.weather.winddirection
          : weatherData.weather.winddirection + "风"
      }}&nbsp;
    </span>
    <span class="sm-hidden">{{ weatherData.weather.windpower }}&nbsp;级</span>
  </div>
  <div class="weather" v-else-if="status === 'loading'">
    <span>{{ loadingText }}</span>
  </div>
  <div class="weather" v-else>
    <span>天气数据获取失败</span>
  </div>
</template>

<script setup>
import { getCity, getWeather, getOtherWeather } from "@/api";
import { Error } from "@icon-park/vue-next";

// 和风天气 Key
const mainKey = import.meta.env.VITE_QWEATHER_KEY;

// 定位失败时的兜底位置（可选），支持「经度,纬度」、城市名、LocationID
// 不配置则直接使用 IP 定位接口
const fallbackLocation = import.meta.env.VITE_QWEATHER_LOCATION || "";

// 浏览器定位超时时间（毫秒）
const GEO_TIMEOUT = 8000;

// 显示状态：loading（定位或请求中）、success、error
const status = ref("loading");
const loadingText = ref("正在定位…");

// 天气数据
const weatherData = reactive({
  adCode: {
    city: null, // 城市
    adcode: null, // 城市编码
  },
  weather: {
    weather: null, // 天气现象
    temperature: null, // 实时气温
    winddirection: null, // 风向描述
    windpower: null, // 风力级别
  },
});

// 取出天气平均值
const getTemperature = (min, max) => {
  try {
    // 计算平均值并四舍五入
    const average = (Number(min) + Number(max)) / 2;
    return Math.round(average);
  } catch (error) {
    console.error("计算温度出现错误：", error);
    return "NaN";
  }
};

// 获取浏览器定位，返回和风天气要求的「经度,纬度」格式
const getGeoLocation = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("当前浏览器不支持定位"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        // 和风天气经纬度最多两位小数，顺序为「经度,纬度」
        resolve(`${longitude.toFixed(2)},${latitude.toFixed(2)}`);
      },
      (error) => reject(new Error(error.message || "定位失败")),
      {
        // 城市级天气不需要高精度定位，关闭高精度可用于省电并加快响应
        enableHighAccuracy: false,
        timeout: GEO_TIMEOUT,
        // 允许使用 10 分钟内的缓存坐标，避免每次刷新都重新定位
        maximumAge: 10 * 60 * 1000,
      },
    );
  });

// 和风天气：先按坐标/城市名反查城市，再取实时天气
const getQWeatherData = async (location) => {
  const city = await getCity(location);
  weatherData.adCode = {
    city: city.city,
    adcode: city.adcode,
  };
  const now = await getWeather(city.adcode);
  weatherData.weather = {
    weather: now.text,
    temperature: now.temp,
    winddirection: now.windDir,
    windpower: now.windScale,
  };
};

// 备用接口：服务端按访问者 IP 定位，无需浏览器授权
const getFallbackWeatherData = async () => {
  const result = await getOtherWeather();
  const data = result?.result;
  if (!data?.city) {
    throw new Error("备用天气接口返回异常");
  }
  weatherData.adCode = {
    city: data.city.City || "未知地区",
  };
  weatherData.weather = {
    weather: data.condition.day_weather,
    temperature: getTemperature(data.condition.min_degree, data.condition.max_degree),
    winddirection: data.condition.day_wind_direction,
    windpower: data.condition.day_wind_power,
  };
};

// 获取天气数据
const getWeatherData = async () => {
  status.value = "loading";

  try {
    // 未配置和风天气 Key，直接使用 IP 定位接口
    if (!mainKey) {
      loadingText.value = "获取天气中…";
      await getFallbackWeatherData();
      status.value = "success";
      return;
    }

    // 优先使用浏览器定位
    let location = "";
    loadingText.value = "正在定位…";
    try {
      location = await getGeoLocation();
    } catch (error) {
      // 用户拒绝授权 / 定位超时 / 浏览器不支持，静默降级，不打扰访客
      console.warn("浏览器定位不可用，尝试兜底位置：", error.message);
    }

    // 定位失败时使用环境变量配置的兜底位置
    if (!location) {
      location = fallbackLocation;
    }

    loadingText.value = "获取天气中…";

    if (location) {
      try {
        await getQWeatherData(location);
      } catch (error) {
        // 和风天气请求失败时降级到 IP 定位接口
        console.warn("和风天气获取失败，降级到备用接口：", error.message);
        await getFallbackWeatherData();
      }
    } else {
      // 既没有定位也没有兜底位置，使用 IP 定位
      await getFallbackWeatherData();
    }

    status.value = "success";
  } catch (error) {
    console.error("天气信息获取失败:", error);
    status.value = "error";
    onError("天气信息获取失败");
  }
};

// 报错信息
const onError = (message) => {
  ElMessage({
    message,
    icon: h(Error, {
      theme: "filled",
      fill: "#efefef",
    }),
  });
  console.error(message);
};

onMounted(() => {
  // 调用获取天气
  getWeatherData();
});
</script>
