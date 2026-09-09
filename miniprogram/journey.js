// Shared by the native mini-program and its web preview. Coordinates are GCJ-02.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined') module.exports = api;
  else root.WeddingJourney = api;
})(typeof window !== 'undefined' ? window : this, function () {
  function hasCoordinates(place) {
    return !!place && Number.isFinite(place.latitude) && Number.isFinite(place.longitude)
      && Math.abs(place.latitude) <= 90 && Math.abs(place.longitude) <= 180;
  }
  function destinations(wedding) {
    return [{...wedding.venue, id: 'venue', label: '婚礼饭店'},
      ...wedding.homes.map((home, index) => ({...home, id: 'home-' + index, label: home.name}))]
      .map(place => ({...place, canNavigate: hasCoordinates(place)}));
  }
  function addressText(place) {
    return [place.district, place.address, place.fullName || place.name, place.room].filter(Boolean).join(' ');
  }
  function distanceKm(origin, destination) {
    if (!hasCoordinates(origin) || !hasCoordinates(destination)) return null;
    const rad = degrees => degrees * Math.PI / 180;
    const dLat = rad(destination.latitude - origin.latitude);
    const dLon = rad(destination.longitude - origin.longitude);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(origin.latitude))
      * Math.cos(rad(destination.latitude)) * Math.sin(dLon / 2) ** 2;
    return 6371.0088 * 2 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)));
  }
  function formatDistance(km) {
    if (km === null || !Number.isFinite(km) || km < 0) return '';
    if (km < 0.1) return '不足 100 米';
    if (km < 1) return '约 ' + Math.round(km * 100) * 10 + ' 米';
    return '约 ' + (km < 10 ? km.toFixed(1) : Math.round(km)) + ' 公里';
  }
  return {hasCoordinates, destinations, addressText, distanceKm, formatDistance};
});
