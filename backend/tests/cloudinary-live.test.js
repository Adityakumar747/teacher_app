const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../config.env') });

const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function testCloudinary() {
  console.log('Testing Cloudinary configuration...');
  console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
  console.log('API Key:', process.env.CLOUDINARY_API_KEY ? 'Present (ending in ' + process.env.CLOUDINARY_API_KEY.slice(-4) + ')' : 'Missing');

  try {
    // 1. Ping Cloudinary API
    const pingRes = await cloudinary.api.ping();
    console.log('✓ Cloudinary API Ping successful:', pingRes);

    // 2. Upload a sample demo educational asset
    console.log('\nUploading demo educational sample image...');
    const uploadRes = await cloudinary.uploader.upload(
      'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600&auto=format&fit=crop&q=80',
      {
        folder: 'sparkology/demo',
        public_id: 'sample_classroom_' + Date.now(),
        tags: ['sparkology', 'demo', 'classroom'],
      }
    );

    console.log('✓ Demo Image uploaded successfully!');
    console.log('  Secure URL:', uploadRes.secure_url);
    console.log('  Public ID:', uploadRes.public_id);
    console.log('  Format:', uploadRes.format);
    console.log('  Bytes:', uploadRes.bytes);

    // 3. Test Signature Generation
    const timestamp = Math.round(new Date().getTime() / 1000);
    const paramsToSign = {
      folder: 'sparkology/homework',
      timestamp: timestamp,
    };
    const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);
    console.log('\n✓ Signed upload params generated successfully:');
    console.log('  Folder:', paramsToSign.folder);
    console.log('  Timestamp:', timestamp);
    console.log('  Signature:', signature);
    console.log('  Direct Upload Endpoint:', `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/auto/upload`);

    console.log('\n=======================================');
    console.log('CLOUDINARY LIVE INTEGRATION: 100% WORKING');
    console.log('=======================================');
  } catch (error) {
    console.error('✗ Cloudinary error:', error);
    process.exit(1);
  }
}

testCloudinary();
