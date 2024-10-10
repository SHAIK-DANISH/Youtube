import {v2 as cloudinary} from "cloudinary";
import fs from "fs";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});


const uploadOnCloudinary = async (localFilePath) =>{
    try {
        if (!localFilePath) return null;
        // upload file on cloudinary
       const response = await cloudinary.uploader.upload(localFilePath, {resource_type:"auto"});
        //file uploaded successfully
        console.log("File uploaded successfully", response.url);
        fs.unlinkSync(localFilePath);  // delete the file from local storage
        return response;
    } catch (error) {
        fs.unlinkSync(localFilePath);  // delete the file from local storage
        return null;
        
    }
}


export {uploadOnCloudinary};

// const uploadResult = await cloudinary.uploader
// .upload(
//     'https://res.cloudinary.com/demo/image/upload/getting-started/shoes.jpg', {
//         public_id: 'shoes',
//     }
// )
// .catch((error) => {
//     console.log(error);
// });