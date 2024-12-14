import React, { useState, useRef } from 'react';
import { fromLonLat } from 'ol/proj';
import { Point } from 'ol/geom';
import { Feature } from 'ol';
import GeoJSON from 'ol/format/GeoJSON';
import { RMap, ROSM, RLayerVector, RStyle, RFeature } from 'rlayers';
import 'ol/ol.css';
import './MapComponent.css';
import MapControls from './MapControls';
import IconMenu from './IconMenu';
import { createEmpty, extend } from 'ol/extent';

// Dynamically require all SVG icons
const iconContext = require.context('./icons', false, /\.svg$/);
const iconFiles = iconContext.keys().reduce((acc, file) => {
  const type = file.replace('./', '').replace('.svg', '');
  acc[type] = iconContext(file); // Map the icon type to its path
  return acc;
}, {});

export default function MapComponent() {
  const [features, setFeatures] = useState([]);
  const [iconFeatures, setIconFeatures] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [hoveredFeature, setHoveredFeature] = useState(null);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [infoBox, setInfoBox] = useState(null);
  const mapRef = useRef(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  const handleGeoJSONUpload = (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const geojson = e.target.result;
      const parsedFeatures = new GeoJSON({
        featureProjection: 'EPSG:3857',
        featureClass: Feature,
      }).readFeatures(geojson);

      setFeatures(parsedFeatures);

      let extent = createEmpty();
      parsedFeatures.forEach((feature) => {
        extend(extent, feature.getGeometry().getExtent());
      });

      if (mapRef.current) {
        mapRef.current.ol.getView().fit(extent, { duration: 1000 });
      }
    };

    if (file) {
      reader.readAsText(file);
    }
  };

  const handleIconJSONUpload = (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const iconData = JSON.parse(e.target.result);
        console.log('Parsed Icon Data:', iconData);

        const newIconFeatures = iconData.nodes.map((node) => {
          const { latitude, longitude, name, info } = node.attributes;
          const type = node.type; // Directly use the type from the node

          console.log('Node Type:', type);
          const iconSrc = getIconByType(type);

          const iconFeature = new Feature({
            geometry: new Point(fromLonLat([longitude, latitude])),
            uid: node.id,
            name,
            info,
            type,
          });

          return { feature: iconFeature, iconSrc };
        });

        setIconFeatures(newIconFeatures);
      } catch (error) {
        console.error('Error parsing icon data:', error);
        alert('Invalid file format. Please upload a valid icon JSON file.');
      }
    };

    if (file) {
      reader.readAsText(file);
    }
  };

  // Use regex to get the icon path based on the type
  const getIconByType = (type) => {
    const iconType = type ? type.toLowerCase().trim() : '';

    console.log('Icon Type:', iconType);

    if (iconFiles[iconType]) {
      return iconFiles[iconType]; // Return the dynamically imported icon path
    } else {
      console.warn('Unknown icon type:', iconType);
      return iconFiles['shop']; // Default icon for unknown types
    }
  };

  const handleIconAdd = (e) => {
    if (isEditMode && isAddMode) {
      const coords = e.map.getCoordinateFromPixel(e.pixel);
      const type = prompt('Enter type for this icon (Hotel, Monument, Shop):', 'Shop')?.trim();
      
      // Validate type
      if (!['hotel', 'monument', 'shop'].includes(type.toLowerCase())) {
        alert('Invalid icon type. Please choose Hotel, Monument, or Shop.');
        return;
      }
  
      const name = prompt('Enter name for this icon:', '')?.trim();
      
      // Optional: Add name validation
      if (!name) {
        alert('Name cannot be empty');
        return;
      }
  
      const info = prompt('Enter info for this icon:', '')?.trim();
      const iconSrc = getIconByType(type);
  
      const newIconFeature = new Feature({
        geometry: new Point(coords),
        uid: Date.now(),
        name,
        info,
        type,
      });
  
      setIconFeatures([...iconFeatures, { feature: newIconFeature, iconSrc }]);
    }
  };

  const handleIconDelete = (uid) => {
    const featureToDelete = iconFeatures.find((f) => f.feature.get('uid') === uid);
    
    const confirmed = window.confirm(`Are you sure you want to delete ${featureToDelete.feature.get('name') || 'this feature'}?`);
    
    if (confirmed) {
      const updatedFeatures = iconFeatures.filter((f) => f.feature.get('uid') !== uid);
      setIconFeatures(updatedFeatures);
    }
  };

  const handleIconClick = (uid, event) => {
    const featureToClick = iconFeatures.find((f) => f.feature.get('uid') === uid);

    if (isEditMode && !isDeleteMode) {
      handleEditName(uid);
    } else if (isEditMode && isDeleteMode) {
      handleIconDelete(uid);
    } else {
      const geometry = featureToClick.feature.getGeometry();
      const coordinates = geometry.getCoordinates();
      const pixelCoordinates = mapRef.current.ol.getPixelFromCoordinate(coordinates);

      if (pixelCoordinates) {
        setSelectedFeature(featureToClick.feature);
        setMenuPosition({
          x: pixelCoordinates[0] + 130,
          y: pixelCoordinates[1] + 190,
        });

        // Show info if already present
        setInfoBox(null); // Clear existing info boxes
      }
    }
  };

  const handleEditName = (uid) => {
    const featureToEdit = iconFeatures.find((f) => f.feature.get('uid') === uid);
    const newName = prompt('Edit name:', featureToEdit.feature.get('name') || '');
    featureToEdit.feature.set('name', newName);
    setIconFeatures([...iconFeatures]);
  };

  const handleEditInfo = (uid) => {
    const featureToEdit = iconFeatures.find((f) => f.feature.get('uid') === uid);
    const newInfo = prompt('Edit info:', featureToEdit.feature.get('info') || '');
    featureToEdit.feature.set('info', newInfo);
    setIconFeatures([...iconFeatures]);
  };

  const handleShowInfo = () => {
    if (selectedFeature) {
      const info = selectedFeature.get('info') || 'No info available';
      setInfoBox({
        text: info,
        x: menuPosition.x + 100,
        y: menuPosition.y + 10,
      });
    }
  };

  const handleCloseMenu = () => {
    setSelectedFeature(null);
    setInfoBox(null); // Close the info box when menu is closed
  };

  const handleSave = () => {
    setIsEditMode(false);
    setIsAddMode(false);
    setIsDeleteMode(false);
    setSelectedFeature(null);
  };

  return (
    <div>
      <label>
        Upload GeoJSON Map:
        <input type="file" accept=".geojson" onChange={handleGeoJSONUpload} />
      </label>
      <br />
      <label>
        Upload Icon JSON:
        <input type="file" accept=".json" onChange={handleIconJSONUpload} />
      </label>

      <MapControls
        isEditMode={isEditMode}
        onToggleEditMode={() => setIsEditMode(!isEditMode)}
        onSave={handleSave}
        onAddMode={() => setIsAddMode(true)}
        onDeleteMode={() => setIsDeleteMode(true)}
        isAddMode={isAddMode}
        isDeleteMode={isDeleteMode}
      />

      {hoveredFeature && (
        <div
          className="name-box"
          style={{
            position: 'absolute',
            top: hoveredFeature.y,
            left: hoveredFeature.x,
          }}
        >
          {hoveredFeature.feature.get('name') || 'No name available'}
        </div>
      )}

      {infoBox && (
        <div
          className="info-box"
          style={{
            position: 'absolute',
            top: infoBox.y,
            left: infoBox.x,
          }}
        >
          {infoBox.text}
        </div>
      )}

      {selectedFeature && (
        <IconMenu
          options={[
            { label: 'Info', onClick: handleShowInfo },
            { label: 'Edit Name', onClick: () => handleEditName(selectedFeature.get('uid')) },
            { label: 'Edit Info', onClick: () => handleEditInfo(selectedFeature.get('uid')) },
          ]}
          onClose={handleCloseMenu}
          position={menuPosition}
        />
      )}

      <RMap
        ref={mapRef}
        className="map"
        width="1100px"
        height="500px"
        initial={{ center: fromLonLat([0, 0]), zoom: 2 }}
        onClick={handleIconAdd}
      >
        <ROSM />
        {features.length > 0 && (
          <RLayerVector features={features}>
            <RStyle.RStyle>
              <RStyle.RStroke color="blue" width={2} />
              <RStyle.RFill color="rgba(0, 0, 255, 0.1)" />
            </RStyle.RStyle>
          </RLayerVector>
        )}

        {iconFeatures.length > 0 && (
          <RLayerVector>
            {iconFeatures.map(({ feature, iconSrc }) => (
              <RFeature
                key={feature.get('uid')}
                feature={feature}
                onPointerEnter={(event) =>
                  setHoveredFeature({
                    feature,
                    x: event.originalEvent.clientX,
                    y: event.originalEvent.clientY,
                  })
                }
                onPointerLeave={() => setHoveredFeature(null)}
                onClick={(event) => handleIconClick(feature.get('uid'), event)}
              >
                <RStyle.RStyle>
                  <RStyle.RIcon src={iconSrc} scale={0.03} />
                </RStyle.RStyle>
              </RFeature>
            ))}
          </RLayerVector>
        )}
      </RMap>
    </div>
  );
}
