// import axios from "axios";
import fetchJsonp from "fetch-jsonp";

/**
 * 音乐播放器
 */

// 获取音乐播放列表
// 音源参数全部写死：Vercel 项目里的环境变量（VITE_SONG_*）优先级高于 .env，
// 且指向了已下线的服务和别的歌单，导致线上歌单不是自己的。
// 这里固定成确认可用的接口与本歌单，避免再被环境变量覆盖
const SONG_API = "https://api.injahow.cn/meting/";
const SONG_SERVER = "netease";
const SONG_TYPE = "playlist";
const SONG_ID = "2564109265";

export const getPlayerList = async (server, type, id) => {
  const res = await fetch(
    `${SONG_API}?server=${server || SONG_SERVER}&type=${type || SONG_TYPE}&id=${id || SONG_ID}`,
  );
  const data = await res.json();

  if (data[0].url.startsWith("@")) {
    // eslint-disable-next-line no-unused-vars
    const [handle, jsonpCallback, jsonpCallbackFunction, url] = data[0].url.split("@").slice(1);
    const jsonpData = await fetchJsonp(url).then((res) => res.json());
    const domain = (
      jsonpData.req_0.data.sip.find((i) => !i.startsWith("http://ws")) ||
      jsonpData.req_0.data.sip[0]
    ).replace("http://", "https://");

    return data.map((v, i) => ({
      name: v.name || v.title,
      artist: v.artist || v.author,
      url: domain + jsonpData.req_0.data.midurlinfo[i].purl,
      cover: v.cover || v.pic,
      lrc: v.lrc,
    }));
  } else {
    return data.map((v) => ({
      name: v.name || v.title,
      artist: v.artist || v.author,
      url: v.url,
      cover: v.cover || v.pic,
      lrc: v.lrc,
    }));
  }
};

/**
 * 一言
 */

// 获取一言数据
export const getHitokoto = async () => {
  const res = await fetch("https://v1.hitokoto.cn");
  return await res.json();
};

/**
 * 天气（和风天气）
 */

// 和风天气通用请求
// 需要 API Host（专属域名，如 xxx.re.qweatherapi.com）与 Key（以 X-QW-Api-Key 请求头传递）
const qweatherRequest = async (path) => {
  const key = import.meta.env.VITE_QWEATHER_KEY;
  const host = import.meta.env.VITE_QWEATHER_HOST || "devapi.qweather.com";

  const res = await fetch(`https://${host}${path}`, {
    headers: {
      "X-QW-Api-Key": key,
    },
  });

  if (!res.ok) {
    throw new Error(`和风天气接口请求失败：${res.status}`);
  }

  const data = await res.json();

  if (data.code !== "200") {
    throw new Error(`和风天气接口返回错误：${data.code}`);
  }

  return data;
};

// 城市查询（GeoAPI）
// location 支持 LocationID（101010100）、经纬度（116.41,39.92）、城市名（beijing）
export const getCity = async (location) => {
  const data = await qweatherRequest(
    `/geo/v2/city/lookup?location=${encodeURIComponent(location)}&number=1`,
  );

  if (!data.location?.length) {
    throw new Error("城市查询失败");
  }

  return {
    city: data.location[0].name,
    adcode: data.location[0].id, // LocationID
  };
};

// 获取和风天气实时天气
export const getWeather = async (location) => {
  const data = await qweatherRequest(`/v7/weather/now?location=${encodeURIComponent(location)}`);
  return data.now;
};

// 获取教书先生天气 API
// https://api.oioweb.cn/doc/weather/GetWeather
export const getOtherWeather = async () => {
  const res = await fetch("https://api.oioweb.cn/api/weather/GetWeather");
  return await res.json();
};
