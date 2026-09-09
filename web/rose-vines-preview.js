window.WEDDING_VINES.styles.forEach(style => {
  const figure = document.createElement('figure'); figure.className = 'vine-sample';
  const caption = document.createElement('figcaption');
  const number = document.createElement('span'); number.textContent = style.id;
  const name = document.createElement('strong'); name.className = 'serif'; name.textContent = style.name;
  caption.append(number, name);
  const image = new Image(); image.src = '../miniprogram/assets/' + style.file;
  image.alt = style.name + '，暗红玫瑰与金色藤蔓'; image.width = 660; image.height = 220;
  figure.append(caption, image); document.querySelector('.vine-catalog').append(figure);
});
