let section = document.querySelector("section");
let city_country = document.querySelector(".city_country");
let time_date = document.querySelector(".time");
let input = document.querySelector("input");
let btn = document.querySelector("button");
let not_valid_city = document.querySelector(".not_valid_city");
let imag = document.querySelector(".icon");
let clouds_description = document.querySelector(".clouds_description");
let heat_degree = document.querySelector(".heat_degree");
let wind_degree = document.querySelector(".wind_degree");
let humidity_degree = document.querySelector(".humidity_degree");
let pressure_degree = document.querySelector(".pressure_degree");
btn.addEventListener("click", async () => {
  try {
    let req = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${input.value}&units=metric&appid=0c4afd0fad2794c5a1f6d145d4b6f8d0`
    );
    let data = await req.json();
    if (data.message) {
      not_valid_city.innerHTML = data.message;
      heat_degree.innerHTML = "";
      humidity_degree.innerHTML = "";
      pressure_degree.innerHTML = "";
      imag.src = "";
      wind_degree.innerHTML = "";
      city_country.innerHTML = "";
      time_date.innerHTML = "";
      clouds_description.innerHTML = "";
    } else {
      clouds_description.innerHTML = data.weather[0].description;
      imag.src = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
      heat_degree.innerHTML = data.main.temp;
      humidity_degree.innerHTML = data.main.humidity;
      pressure_degree.innerHTML = data.main.pressure;
      wind_degree.innerHTML = data.wind.speed;
      let req2 = await fetch(
        `https://api.timezonedb.com/v2.1/get-time-zone?key=Z2EGKFK0XNH9&format=json&by=position&lat=${data.coord.lat}&lng=${data.coord.lon}`
      );
      let data2 = await req2.json();
      city_country.innerHTML = `${data2.cityName}  /  ${data2.countryName}`;
      time_date.innerHTML = data2.formatted;
      let req3 = await fetch(
        `https://pixabay.com/api/videos/?key=42510262-a578e62c7ae6b8b11ba215f3b&q=${input.value}`
      );
      let data3 = await req3.json();
      section.style.cssText =
        "background-image: url(Lovepik_com-361346866-background-with-sun-shining-through-gorgeous-image-captured-above-the-clouds.jpg);";
      if (data3.hits[0].videos.medium.thumbnail) {
        section.style.cssText = `background-image: url(${data3.hits[0].videos.medium.thumbnail})`;
      }
    }
  } catch (e) {
    return e.message;
  }
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    btn.click();
  }
});
